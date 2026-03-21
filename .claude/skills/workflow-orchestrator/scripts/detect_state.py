#!/usr/bin/env python3
import os
import glob
import json
import sys
from pathlib import Path

def find_active_feature():
    """
    Finds the most recently modified feature directory in specs/
    If the most recent one is marked 'completed', returns None (to trigger new feature).
    """
    specs_dir = Path("specs")
    if not specs_dir.exists():
        return None
    
    feature_dirs = [d for d in specs_dir.iterdir() if d.is_dir()]
    if not feature_dirs:
        return None
        
    def get_latest_mtime(path):
        mtimes = [path.stat().st_mtime]
        for p in path.rglob('*'):
            mtimes.append(p.stat().st_mtime)
        return max(mtimes)

    active_feature = max(feature_dirs, key=get_latest_mtime)
    
    # Check for completion marker in spec.md
    spec_path = active_feature / "spec.md"
    if spec_path.exists():
        try:
            with open(spec_path, 'r', encoding='utf-8') as f:
                content = f.read()
                if "status: completed" in content.lower():
                    return None
        except Exception:
            pass

    return active_feature

def check_task_status(tasks_file):
    """
    Reads tasks.md to determine the current execution stage based on markers.
    """
    if not tasks_file.exists():
        return None
        
    try:
        with open(tasks_file, 'r', encoding='utf-8') as f:
            content = f.read().lower()
            
            if "status: verified" in content:
                return 9 # Review
            if "status: implementation_completed" in content:
                return 8 # Verify
            if "status: kanban_synced" in content:
                return 7 # Execute
            
            return 6 # Sync
    except Exception:
        return 6

def detect_stage(feature_dir):
    if not feature_dir:
        return {
            "stage": 1,
            "stage_name": "Specify",
            "message": "目前沒有進行中的功能。準備開始 Step 1: Specify。",
            "command": "/speckit.specify",
            "recommended_skills": ["brainstorming", "frontend-design"],
            "feature": None
        }

    feature_name = feature_dir.name
    spec_file = feature_dir / "spec.md"
    plan_file = feature_dir / "plan.md"
    tasks_file = feature_dir / "tasks.md"
    tests_dir = Path("tests") / feature_name
    has_tests = tests_dir.exists() and any(tests_dir.iterdir())

    # Step 1 -> 2
    if not spec_file.exists():
        return {
            "stage": 1,
            "stage_name": "Specify",
            "message": f"功能 '{feature_name}' 缺少 spec.md。",
            "command": "/speckit.specify",
            "recommended_skills": ["brainstorming", "frontend-design"],
            "feature": feature_name
        }

    # Step 2 -> 3
    if not has_tests:
        return {
            "stage": 2,
            "stage_name": "Clarify",
            "message": f"spec.md 已存在。下一步：Step 2 Clarify。",
            "command": "/speckit.clarify",
            "recommended_skills": [],
            "feature": feature_name
        }

    # Step 3 -> 4
    if not plan_file.exists():
        return {
            "stage": 4, # Stage 3 is TDD, which produces tests. If tests exist, we go to Plan.
            "stage_name": "Plan",
            "message": f"測試已建立。下一步：Step 4 Plan。",
            "command": "/speckit.plan",
            "recommended_skills": ["writing-plans"],
            "feature": feature_name
        }

    # Step 4 -> 5
    if not tasks_file.exists():
        return {
            "stage": 5,
            "stage_name": "Task",
            "message": f"計畫已建立。下一步：Step 5 Task。",
            "command": "/speckit.task",
            "recommended_skills": [],
            "feature": feature_name
        }

    # Step 5 -> 6/7/8/9 (Based on tasks.md markers)
    task_stage = check_task_status(tasks_file)
    
    if task_stage == 6:
        return {
            "stage": 6,
            "stage_name": "Task to Kanban",
            "message": f"任務清單已建立。下一步：Step 6 Task to Kanban (將任務轉交給 Kanban)。",
            "command": "RUN_WORKFLOW_STEP_6",
            "recommended_skills": ["workflow-step-6-task-to-kanban"],
            "feature": feature_name
        }
    
    if task_stage == 7:
        return {
            "stage": 7,
            "stage_name": "Execute Tasks",
            "message": f"任務已同步。下一步：Step 7 Execute Tasks (執行任務)。",
            "command": "RUN_WORKFLOW_STEP_7",
            "recommended_skills": ["workflow-step-7-execute-task-kanban"],
            "feature": feature_name
        }

    if task_stage == 8:
        return {
            "stage": 8,
            "stage_name": "Chrome DevTools Verify",
            "message": f"實作已完成。下一步：Step 8 Chrome DevTools Verify (使用 Chrome DevTools 驗收)。",
            "command": "RUN_WORKFLOW_STEP_8",
            "recommended_skills": ["workflow-step-8-chrome-devtools-verify"],
            "feature": feature_name
        }

    if task_stage == 9:
        return {
            "stage": 9,
            "stage_name": "Review",
            "message": f"驗收已通過。下一步：Step 9 Review (代碼審查)。",
            "command": "RUN_WORKFLOW_STEP_9",
            "recommended_skills": ["workflow-step-9-review"],
            "feature": feature_name
        }

    return {
        "stage": 0,
        "message": "未知狀態，請檢查檔案結構。",
        "feature": feature_name
    }

def main():
    active_feature = find_active_feature()
    state = detect_stage(active_feature)
    print(json.dumps(state, indent=2, ensure_ascii=False))

if __name__ == "__main__":
    main()