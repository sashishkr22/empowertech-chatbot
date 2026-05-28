import docx

def check_ch3_section(file_path, section_num):
    doc = docx.Document(file_path)
    capture = False
    section_text = []
    found = False
    for p in doc.paragraphs:
        if p.text.strip().startswith(section_num):
            capture = True
            found = True
        elif capture and p.text.strip().startswith("3.") and not p.text.strip().startswith(section_num):
            capture = False
            break
        elif capture and "Chapter 4" in p.text:
            capture = False
            break
            
        if capture:
            section_text.append(p.text)
            
    if not found:
        return "Section not found."
    return "\n".join(section_text)

if __name__ == "__main__":
    # Check v3 which is the latest highlighted/updated version
    print(check_ch3_section("Project Report (Updated v3).docx", "3.6"))
