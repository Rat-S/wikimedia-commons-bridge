from typing import List, Optional
import datetime

def format_license_template(license_code: str) -> str:
    """Map a license shortcode to the corresponding Wikimedia Commons self-licensing template."""
    code = license_code.lower().strip()
    if code in ("cc-by-sa-4.0", "cc-by-sa"):
        return "{{self|cc-by-sa-4.0}}"
    elif code in ("cc-by-4.0", "cc-by"):
        return "{{self|cc-by-4.0}}"
    elif code in ("cc0-1.0", "cc0", "public-domain"):
        return "{{self|cc-zero}}"
    else:
        # Fallback default to CC-BY-SA-4.0
        return "{{self|cc-by-sa-4.0}}"

def generate_commons_wikitext(
    description: str,
    date_str: Optional[str],
    author_username: str,
    license_code: str,
    categories: List[str],
    lat: Optional[float] = None,
    lon: Optional[float] = None
) -> str:
    """
    Generate the wikitext file description page for Wikimedia Commons.
    Conforms to the standard {{Information}} template layout.
    """
    # Clean and parse date
    final_date = ""
    if date_str:
        try:
            # Try parsing ISO timestamp from Google Picker (e.g. 2026-07-10T12:00:00Z)
            if "T" in date_str:
                date_str = date_str.split("T")[0]
            # Validate YYYY-MM-DD structure
            datetime.date.fromisoformat(date_str)
            final_date = date_str
        except ValueError:
            # Fallback to whatever string is passed if not strict ISO
            final_date = date_str
            
    # Format categories
    formatted_categories = []
    for cat in categories:
        cat_clean = cat.strip().replace(" ", "_")
        if cat_clean:
            formatted_categories.append(f"[[Category:{cat_clean.replace('_', ' ')}]]")
            
    categories_block = "\n".join(formatted_categories)
    
    # Format licensing
    license_block = format_license_template(license_code)
    
    # Format geocoding
    location_block = ""
    if lat is not None and lon is not None:
        location_block = f"{{{{Location|{lat}|{lon}}}}}\n"

    wikitext = f"""== {{{{int:filedesc}}}} ==
{{{{Information
|description    = {{{{en|1={description}}}}}
|date           = {final_date}
|source         = {{{{Own photo}}}} — transferred from Google Photos via [[toolforge:commons-bridge|Commons Bridge]]
|author         = [[User:{author_username}|{author_username}]]
|permission     =
|other versions =
}}}}
{location_block}
== {{{{int:license-header}}}} ==
{license_block}

{categories_block}
"""
    return wikitext
