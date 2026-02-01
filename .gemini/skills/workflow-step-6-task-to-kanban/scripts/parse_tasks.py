#!/usr/bin/env python3
import sys
import re
import json

def parse_tasks(file_path):
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except FileNotFoundError:
        print(json.dumps({"error": f"File not found: {file_path}"}))
        return

    tasks = []
    current_task = None
    
    # Simple parser for markdown tasks
    # Looks for lines starting with "- [ ] Task Title"
    # And description indented below
    
    lines = content.split('\n')
    for line in lines:
        task_match = re.match(r'^\s*-\s*\[\s*\]\s*(.+)', line)
        if task_match:
            if current_task:
                tasks.append(current_task)
            current_task = {
                "title": task_match.group(1).strip(),
                "description": ""
            }
        elif current_task and line.strip():
            current_task["description"] += line.strip() + "\n"
            
    if current_task:
        tasks.append(current_task)
        
    print(json.dumps(tasks, indent=2, ensure_ascii=False))

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 parse_tasks.py <tasks_file_path>")
        sys.exit(1)
    parse_tasks(sys.argv[1])
