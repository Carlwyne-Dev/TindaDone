import os
import re

files = [
    'app/(tabs)/products.tsx', 'app/(tabs)/sell.tsx', 
    'app/(tabs)/stats.tsx', 'app/(tabs)/utang.tsx', 'app/(tabs)/expenses.tsx'
]

for f in files:
    with open(f, 'r', encoding='utf-8') as file: content = file.read()
    
    new_header_style = '''  boutiqueHeader: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    backgroundColor: Theme.colors.primary,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: Theme.colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 10,
  },'''
    content = re.sub(r'  boutiqueHeader: \{[^\}]+?\},', new_header_style, content)
    content = re.sub(r'(boutiqueTitle: \{[^\}]+?color: )Theme\.colors\.onSurface', r'\1"#FFFFFF"', content)
    content = re.sub(r'(boutiqueSubtitle: \{[^\}]+?color: )Theme\.colors\.outline', r'\1"rgba(255,255,255,0.8)"', content)
    content = re.sub(r'fontFamily: Theme\.typography\.bodyMedium,(\s+fontSize: 14)', r'fontFamily: Theme.typography.bodyBold,\1', content)
    
    if 'textTransform' not in content:
        content = re.sub(r'(fontSize: 14,\s+color: "rgba\(255,255,255,0\.8\)",)', r'\1\n    textTransform: "uppercase",\n    letterSpacing: 1,', content)
    
    new_btn_style = '''  settingsHeaderBtn: {
    padding: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 14,
  },'''
    content = re.sub(r'  settingsHeaderBtn: \{[^\}]+?\},', new_btn_style, content)
    content = content.replace('<Settings size={22} color={Theme.colors.primary} />', '<Settings size={22} color="#FFF" />')
    
    with open(f, 'w', encoding='utf-8') as file: file.write(content)
