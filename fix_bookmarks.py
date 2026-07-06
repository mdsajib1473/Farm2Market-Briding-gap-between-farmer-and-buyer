"""Fix duplicate bookmark IDs in unpacked word/document.xml"""
import re, sys

path = sys.argv[1]
with open(path, encoding="utf-8") as f:
    content = f.read()

counter = [0]

def next_id(_):
    counter[0] += 1
    return f'w:id="{counter[0]}"'

# Replace w:id="..." inside bookmarkStart and bookmarkEnd elements
# We need to give each start and its matching end the SAME id.
# Strategy: find all bookmarkStart elements, capture their name,
# assign sequential id, then fix matching bookmarkEnd.

# First, collect all bookmarkStart names and assign ids
name_to_id = {}
def assign_start(m):
    name = re.search(r'w:name="([^"]+)"', m.group(0))
    if name:
        nm = name.group(1)
        if nm not in name_to_id:
            counter[0] += 1
            name_to_id[nm] = counter[0]
        new_id = name_to_id[nm]
        return re.sub(r'w:id="[^"]*"', f'w:id="{new_id}"', m.group(0))
    return m.group(0)

content = re.sub(r'<w:bookmarkStart[^/]*/>', assign_start, content)

# Now fix bookmarkEnd: they appear in order matching their starts.
# The ends don't have names, so we replace them in sequence.
starts_in_order = []
for m in re.finditer(r'<w:bookmarkStart[^/]*w:name="([^"]+)"[^/]*/>', content):
    starts_in_order.append(name_to_id[m.group(1)])

end_idx = [0]
def fix_end(m):
    if end_idx[0] < len(starts_in_order):
        new_id = starts_in_order[end_idx[0]]
        end_idx[0] += 1
        return f'<w:bookmarkEnd w:id="{new_id}"/>'
    return m.group(0)

content = re.sub(r'<w:bookmarkEnd[^/]*/>', fix_end, content)

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

print(f"Fixed {counter[0]} unique bookmark IDs")
