"""Resolve append-only conflicts by keeping both sides (ours then theirs). Usage: python3 union_merge.py FILE..."""
import re, sys

for f in sys.argv[1:]:
    s = open(f).read()
    pat = re.compile(r"<<<<<<< [^\n]*\n(.*?)=======\n(.*?)>>>>>>> [^\n]*\n", re.S)
    n = len(pat.findall(s))
    s = pat.sub(lambda m: m.group(1) + m.group(2), s)
    open(f, "w").write(s)
    print(f, "resolved", n)
