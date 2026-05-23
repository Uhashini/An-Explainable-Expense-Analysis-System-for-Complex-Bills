import json
import os

def validate_extraction():
    json_path = os.path.join("test_image", "ocr_output.json")
    
    if not os.path.exists(json_path):
        print(f"Error: {json_path} not found. Please run an OCR extraction first.")
        return

    with open(json_path, 'r') as f:
        data = json.load(f)

    words = [w.upper() for w in data.get("words", [])]
    
    # Mandatory fields for expense analysis
    required_keywords = ["TOTAL", "CASH", "CHANGE", "APPLE", "BANANA", "YOGURT"]
    
    print("="*40)
    print("      LOCAL OCR VALIDATION REPORT")
    print("="*40)
    
    found_all = True
    for kw in required_keywords:
        if kw in words:
            print(f"[PASSED] Found Keyword: {kw}")
        else:
            print(f"[FAILED] Missing Keyword: {kw}")
            found_all = False
            
    # Check for numerical values (prices)
    numbers = [w for w in data.get("words", []) if any(char.isdigit() for char in w)]
    print(f"\nExtracted Numbers/Costs: {len(numbers)} found.")
    if len(numbers) > 5:
        print("[PASSED] Sufficient numerical data extracted for analysis.")
    else:
        print("[FAILED] Low numerical density detected.")
        found_all = False

    print("="*40)
    if found_all:
        print("STATUS: SYSTEM READY FOR LAYOUTLMV3")
    else:
        print("STATUS: PERFORMANCE OPTIMIZATION REQUIRED")
    print("="*40)

if __name__ == "__main__":
    validate_extraction()
