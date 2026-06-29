import os

files = [
    'app/(tabs)/products.tsx', 'app/(tabs)/sell.tsx', 
    'app/(tabs)/stats.tsx', 'app/(tabs)/utang.tsx', 'app/(tabs)/expenses.tsx'
]

for f in files:
    with open(f, 'r', encoding='utf-8') as file:
        content = file.read()
    
    # Fix the broken import syntax:
    bad_import1 = "import React\nimport { LinearGradient } from 'expo-linear-gradient';, {"
    bad_import2 = "import React\nimport { LinearGradient } from 'expo-linear-gradient'; from 'react';"
    
    content = content.replace(bad_import1, "import React, {")
    content = content.replace(bad_import2, "import React from 'react';")
    
    # Add the LinearGradient import safely to the very top
    if "from 'expo-linear-gradient'" not in content:
        content = "import { LinearGradient } from 'expo-linear-gradient';\n" + content
        
    with open(f, 'w', encoding='utf-8') as file:
        file.write(content)
