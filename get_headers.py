import docx

def list_headers(file_path):
    doc = docx.Document(file_path)
    headers = []
    for p in doc.paragraphs:
        # Simple heuristic for headers: bold or high level numbering
        if p.style.name.startswith('Heading') or (len(p.text.split()) < 10 and (p.text.strip().startswith(('Chapter', '1.', '2.', '3.', '4.', '5.')))):
            headers.append(p.text.strip())
    return "\n".join(headers)

if __name__ == "__main__":
    print(list_headers("Project Report (Updated v4).docx"))
