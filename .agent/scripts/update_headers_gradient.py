import os
import re

files = [
    'app/(tabs)/products.tsx', 'app/(tabs)/sell.tsx', 
    'app/(tabs)/stats.tsx', 'app/(tabs)/utang.tsx', 'app/(tabs)/expenses.tsx'
]

for f in files:
    with open(f, 'r', encoding='utf-8') as file:
        content = file.read()
    
    # 1. Add import if missing
    if 'expo-linear-gradient' not in content:
        content = content.replace("import React", "import React\nimport { LinearGradient } from 'expo-linear-gradient';")
    
    # 2. Update the JSX view to LinearGradient
    # Find the block: <View style={styles.boutiqueHeader}> ... </View>
    # Note: Because the header contains nested views, a simple regex is risky, but we know the structure.
    # It always looks like:
    # <View style={styles.boutiqueHeader}>
    #   <View>
    #      ...
    #   </View>
    #   <TouchableOpacity ...
    #   </TouchableOpacity>
    # </View>
    
    # Replace opening tag
    content = content.replace('<View style={styles.boutiqueHeader}>', "<LinearGradient colors={['#059669', '#0d9488']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.boutiqueHeader}>")
    
    # Replace closing tag. We only want to replace the closing tag of the boutiqueHeader.
    # We can do this with a regex that matches the LinearGradient start, then matches up to the first </TouchableOpacity>, then replaces the very next </View> with </LinearGradient>
    # Even simpler: just use regex to find the exact block since it's consistent.
    
    pattern = r"(<LinearGradient[^>]+style=\{styles\.boutiqueHeader\}>.*?)(</TouchableOpacity>\s*)</View>"
    content = re.sub(pattern, r"\1\2</LinearGradient>", content, flags=re.DOTALL)
    
    # 3. If there is NO touchableOpacity (like in stats.tsx? Let's check stats.tsx)
    # Actually wait, stats, utang, expenses all have settingsHeaderBtn.
    
    # 4. Modify boutiqueHeader style to remove backgroundColor and add better padding
    new_header_style = '''  boutiqueHeader: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 28,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: -10, // Pulls the content up slightly to overlap
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 10,
  },'''
    content = re.sub(r'  boutiqueHeader: \{[^\}]+?\},', new_header_style, content)
    
    with open(f, 'w', encoding='utf-8') as file:
        file.write(content)
