"""PubChem-based molecular validation and verification service."""

import json
from typing import Any, Dict, List, Optional, Tuple
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import urlopen


class PubChemValidator:
    """Validates molecular structures against PubChem dataset."""

    PUBCHEM_REST = "https://pubchem.ncbi.nlm.nih.gov/rest/pug"

    def __init__(self) -> None:
        self.cache: Dict[str, Any] = {}

    async def validate_smiles_correctness(self, smiles: str) -> Tuple[bool, Dict[str, Any]]:
        """
        Validate SMILES string against PubChem.

        Returns:
            (is_valid, details):
            - is_valid: True if SMILES is chemically valid per PubChem
            - details: Metadata about the compound (molecular weight, formula, etc.)
        """
        if not smiles or not isinstance(smiles, str):
            return False, {"error": "Invalid SMILES input"}

        try:
            # Query PubChem for compound by SMILES
            url = f"{self.PUBCHEM_REST}/compound/smiles/{quote(smiles, safe='')}/JSON"
            details = await self._fetch_json(url, timeout=5)

            if not details:
                return False, {"error": "SMILES not found in PubChem"}

            compounds = details.get("PC_Compounds", [])
            if not compounds:
                return False, {"error": "No compounds found for SMILES"}

            compound = compounds[0]
            props = compound.get("props", [])

            metadata = {
                "pubchem_cid": compound.get("id", {}).get("id", {}).get("cid"),
                "molecular_weight": self._extract_property(props, "Molecular Weight"),
                "molecular_formula": self._extract_property(props, "Molecular Formula"),
                "iupac_name": self._extract_property(props, "IUPAC Name"),
                "canonical_smiles": self._extract_property(props, "Canonical SMILES"),
                "inchi": self._extract_property(props, "InChI"),
                "inchi_key": self._extract_property(props, "InChI Key"),
            }

            return True, metadata

        except (HTTPError, URLError, Exception) as exc:
            return False, {"error": f"PubChem lookup failed: {str(exc)}"}

    async def check_equivalence(self, smiles1: str, smiles2: str) -> Tuple[bool, str]:
        """Check if two SMILES strings represent the same molecule."""
        if not smiles1 or not smiles2:
            return False, "One or both SMILES strings are empty."

        valid1, details1 = await self.validate_smiles_correctness(smiles1)
        valid2, details2 = await self.validate_smiles_correctness(smiles2)

        if not valid1 or not valid2:
            return False, "One or both SMILES strings are invalid in PubChem."

        cid1 = details1.get("pubchem_cid")
        cid2 = details2.get("pubchem_cid")

        if cid1 and cid2:
            return cid1 == cid2, f"Comparison: CID {cid1} vs CID {cid2}"

        # Fallback: compare canonical SMILES
        canonical1 = details1.get("canonical_smiles", "")
        canonical2 = details2.get("canonical_smiles", "")

        if canonical1 and canonical2:
            return canonical1 == canonical2, f"Canonical comparison completed"

        return False, "Could not determine molecular equivalence."

    async def batch_validate(self, smiles_list: List[str]) -> Dict[str, Tuple[bool, Dict[str, Any]]]:
        """Validate multiple SMILES strings."""
        results = {}
        for smiles in smiles_list:
            valid, details = await self.validate_smiles_correctness(smiles)
            results[smiles] = (valid, details)
        return results

    def _extract_property(self, props: List[Dict[str, Any]], property_name: str) -> Optional[str]:
        """Extract a property from PubChem compound properties list."""
        for prop in props:
            urn = prop.get("urn", {})
            label = urn.get("label", "")
            if label == property_name:
                value_list = prop.get("value", {}).get("sval", [])
                if isinstance(value_list, list) and value_list:
                    return value_list[0]
                value_list = prop.get("value", {}).get("fval", [])
                if isinstance(value_list, list) and value_list:
                    return str(value_list[0])
        return None

    async def _fetch_json(self, url: str, timeout: int = 5) -> Optional[Dict[str, Any]]:
        """Fetch JSON from URL with timeout."""
        try:
            with urlopen(url, timeout=timeout) as response:
                if response.status == 200:
                    return json.loads(response.read().decode("utf-8"))
        except Exception:
            return None
        return None

    def suggest_corrections(self, invalid_smiles: str) -> List[str]:
        """Suggest common SMILES corrections."""
        suggestions = []

        # Remove leading/trailing whitespace
        cleaned = invalid_smiles.strip()
        if cleaned != invalid_smiles:
            suggestions.append(cleaned)

        # Common corrections
        corrections = [
            (r"\(.*?\)", ""),  # Remove parentheses
            (r"\d+", ""),  # Remove ring closures
            ("[", ""),
            ("]", ""),
        ]

        for pattern, replacement in corrections:
            import re

            candidate = re.sub(pattern, replacement, invalid_smiles)
            if candidate and candidate not in suggestions:
                suggestions.append(candidate)

        return suggestions
