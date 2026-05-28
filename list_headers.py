import docx

def list_headers(file_path):
    doc = docx.Document(file_path)
    print(f"--- Structure of {file_path} ---")
    for p in doc.paragraphs:
        # Heuristic for headers: short text, or specific styles
        text = p.text.strip()
        if not text:
            continue
        # Often headers start with numbers or are in all caps or have header styles
        if p.style.name.startswith('Heading') or (len(text) < 60 and (text[0].isdigit() or text.isupper())):
            print(f"{p.style.name}: {text}")

if __name__ == "__main__":
    list_headers("Project Report (Updated v3).docx")
