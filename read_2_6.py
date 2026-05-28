import docx

def get_section_2_6(file_path):
    doc = docx.Document(file_path)
    found = False
    content = []
    for p in doc.paragraphs:
        text = p.text.strip()
        if text.startswith("2.6 Application Gap"):
            found = True
            content.append(text)
            continue
        if found:
            if text.startswith("2.7") or text.startswith("Chapter 3"):
                break
            if text:
                content.append(text)
    
    if found:
        print("\n".join(content))
    else:
        print("Section 2.6 not found.")

if __name__ == "__main__":
    get_section_2_6("Project Report (Updated v3).docx")
