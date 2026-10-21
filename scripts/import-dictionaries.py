"""把选定的 qwerty-learner 词库转换为本站 JSON；可传入已下载词库的目录。"""
import hashlib
import json
import re
import sys
from pathlib import Path
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parent.parent
COMMIT = '1182426f2bd0a28c95302c33f9e19136b1262a70'
UPSTREAM = f'https://raw.githubusercontent.com/RealKai42/qwerty-learner/{COMMIT}'
catalog = json.loads((ROOT / 'dictionaries.json').read_text())
source_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else None
notices = ['词库来源：RealKai42/qwerty-learner', f'上游版本：{COMMIT}',
           'https://github.com/RealKai42/qwerty-learner',
           '上游仓库附带 GPL-3.0 许可，见 LICENSE-qwerty-learner.txt。',
           '本地转换：取 name 为键；合并同词的全部 trans，去除重复释义；省略音标。',
           '保留上游词序、英文短语、大小写和标点；词条数以转换后的实际数量为准。', '']
for entry in catalog:
    if 'source' not in entry:
        continue
    filename = entry['source']
    raw = (source_dir / filename).read_bytes() if source_dir else urlopen(f'{UPSTREAM}/public/dicts/{filename}', timeout=40).read()
    words = {}
    for item in json.loads(raw):
        word = item['name'].strip()
        translations = [re.sub(r'\s+', ' ', text).strip() for text in item['trans']]
        if not word or not translations or not any(translations):
            raise ValueError(f'{filename} 包含空词条或空释义')
        bucket = words.setdefault(word, [])
        for text in translations:
            if text and text not in bucket:
                bucket.append(text)
    converted = {word: '；'.join(translations) for word, translations in words.items()}
    target = ROOT / entry['url']
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(converted, ensure_ascii=False, indent=2) + '\n')
    digest = hashlib.sha256(raw).hexdigest()
    notices.append(f"{entry['name']}：{filename} → {entry['url']}（{len(converted)} 词）\n原始文件 SHA-256：{digest}")
    print(f"{entry['name']}: {len(converted)}")
(ROOT / 'dicts/NOTICE.txt').write_text('\n'.join(notices) + '\n')
license_file = ROOT / 'dicts/LICENSE-qwerty-learner.txt'
if not license_file.exists():
    license_file.write_bytes(urlopen(f'{UPSTREAM}/LICENSE', timeout=40).read())
