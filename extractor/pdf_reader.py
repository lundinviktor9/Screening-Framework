"""
Extract text from PDF files.
"""

from pathlib import Path
from typing import Tuple, Union

try:
    from pypdf import PdfReader
    PYPDF_AVAILABLE = True
except ImportError:
    PYPDF_AVAILABLE = False


def read_pdf(pdf_path: Union[str, Path]) -> str:
    """
    Idiomatic wrapper: extract text from a PDF and return it, or raise.

    Raises:
        FileNotFoundError: if the path does not exist.
        RuntimeError:      if pypdf is missing, the file is not a PDF,
                           or no text could be extracted.
    """
    ok, msg, text = extract_text_from_pdf(pdf_path)
    if not ok:
        # Decide the most informative exception from the message
        lower = msg.lower()
        if "not found" in lower:
            raise FileNotFoundError(msg)
        raise RuntimeError(msg)
    return text


def extract_text_from_pdf(pdf_path: Union[str, Path]) -> Tuple[bool, str, str]:
    """
    Extract text from a PDF file.

    Args:
        pdf_path: Path to the PDF file

    Returns:
        Tuple of (success, message, extracted_text)
    """
    if not PYPDF_AVAILABLE:
        return False, "pypdf not installed. Run: pip install pypdf", ""

    pdf_path = Path(pdf_path)

    if not pdf_path.exists():
        return False, f"PDF file not found: {pdf_path}", ""

    if not pdf_path.suffix.lower() == ".pdf":
        return False, f"File is not a PDF: {pdf_path}", ""

    try:
        reader = PdfReader(pdf_path)
        text_parts = []

        for page_num, page in enumerate(reader.pages, start=1):
            page_text = page.extract_text()
            if page_text:
                text_parts.append(f"--- Page {page_num} ---")
                text_parts.append(page_text.strip())

        if not text_parts:
            return False, "No text could be extracted from PDF", ""

        full_text = "\n\n".join(text_parts)
        return True, f"Extracted {len(reader.pages)} pages", full_text

    except Exception as e:
        return False, f"Error reading PDF: {e}", ""


def extract_text_from_pdf_folder(
    folder_path: Union[str, Path],
    output_folder: Union[str, Path, None] = None,
) -> Tuple[int, int, list]:
    """
    Extract text from all PDFs in a folder.

    Args:
        folder_path: Path to folder containing PDFs
        output_folder: Optional folder to save .txt files (defaults to same folder)

    Returns:
        Tuple of (success_count, fail_count, results_list)
        results_list contains dicts with {pdf_path, success, message, text_path}
    """
    folder_path = Path(folder_path)
    if not folder_path.is_dir():
        return 0, 0, [{"pdf_path": str(folder_path), "success": False, "message": "Not a directory"}]

    output_folder = Path(output_folder) if output_folder else folder_path
    output_folder.mkdir(parents=True, exist_ok=True)

    pdf_files = list(folder_path.glob("*.pdf")) + list(folder_path.glob("*.PDF"))

    if not pdf_files:
        return 0, 0, [{"pdf_path": str(folder_path), "success": False, "message": "No PDF files found"}]

    success_count = 0
    fail_count = 0
    results = []

    for pdf_file in pdf_files:
        ok, msg, text = extract_text_from_pdf(pdf_file)

        result = {
            "pdf_path": str(pdf_file),
            "success": ok,
            "message": msg,
        }

        if ok:
            text_path = output_folder / f"{pdf_file.stem}.txt"
            text_path.write_text(text, encoding="utf-8")
            result["text_path"] = str(text_path)
            success_count += 1
        else:
            fail_count += 1

        results.append(result)

    return success_count, fail_count, results
