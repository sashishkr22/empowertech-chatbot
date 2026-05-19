import os
import json
import uuid
import zipfile

base_dir = 'empowertech-chatbot/dialogflow'
output_zip = 'empowertech-chatbot/dialogflow.zip'

def rebuild():
    # Rebuild Zip
    with zipfile.ZipFile(output_zip, 'w', zipfile.ZIP_DEFLATED) as zf:
        # Add root files
        zf.write(os.path.join(base_dir, 'agent.json'), 'agent.json')
        zf.write(os.path.join(base_dir, 'package.json'), 'package.json')

        # Add intents
        intents_dir = os.path.join(base_dir, 'intents')
        for filename in os.listdir(intents_dir):
            if filename.endswith('.json'):
                old_path = os.path.join(intents_dir, filename)
                new_name = filename.replace(' ', '_')
                zf.write(old_path, os.path.join('intents', new_name))

        # Add entities
        entities_dir = os.path.join(base_dir, 'entities')
        for filename in os.listdir(entities_dir):
            if filename.endswith('.json'):
                old_path = os.path.join(entities_dir, filename)
                new_name = filename.replace(' ', '_')
                zf.write(old_path, os.path.join('entities', new_name))

if __name__ == "__main__":
    rebuild()
    print("Rebuild complete with new intents.")
