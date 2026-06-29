import os

files = [
    'app/(tabs)/products.tsx', 'app/(tabs)/sell.tsx', 
    'app/(tabs)/stats.tsx', 'app/(tabs)/utang.tsx', 'app/(tabs)/expenses.tsx'
]

fragment1 = """  },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 10,
  },"""

fragment2 = """  },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 10,
  },\n"""

for f in files:
    with open(f, 'r', encoding='utf-8') as file:
        content = file.read()
    
    # Simple replacement to remove the dangling artifact
    # We replace fragment1 with "  },"
    if fragment1 in content:
        content = content.replace(fragment1, "  },")
    
    with open(f, 'w', encoding='utf-8') as file:
        file.write(content)
