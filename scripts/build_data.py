"""依兩頁原始 PDF 人工核對之登錄表建立 JSON；固定 ID，新增請接續編號。"""
import hashlib
import json
from pathlib import Path
from collections import Counter

ROOT = Path(__file__).resolve().parents[1]
PDF = ROOT / '【葉氏祖籍：漳州府海澄縣】.pdf'
AUDITED_SHA256 = '8d267c6e291a40de00032a9899393522c10ec4d8a3b2c566828aa180ecf532e5'
# ID | 原文姓名 | 世代 | 原文上代 ID | 頁 | 原文註記 | 括號內別名
# 上代線條未直接註明父／母角色，故用中性的 parent-child 關係，不推定性別。
REGISTER = '''
P0001|葉公名妻|16||1||
P0002|葉媽名慈淑|||1||
P0003|葉俊清|17|P0001|1||
P0004|葉石城|18|P0003|1||
P0005|葉阿每|19|P0004|1|(葉阿送)|葉阿送
P0006|葉阿有|20|P0005|1||
P0007|葉春交|17|P0001|1||
P0008|陳玉娘|||1||
P0009|葉石南|18|P0007|1||
P0010|葉樹生|19|P0009|1||
P0011|葉有財|20|P0010|1||
P0012|葉文章|20|P0010|1||
P0013|葉文得|20|P0010|1||
P0014|葉樹筍|19|P0009|1||
P0015|葉有全|20|P0014|1||
P0016|葉有順|20|P0014|1||
P0017|葉芳雄|20|P0014|1||
P0018|葉樹|19|P0009|1||
P0019|葉慶雲|20|P0018|1||
P0020|葉慶富|20|P0018|1||
P0021|葉啟男|20|P0018|1||
P0022|葉石枝|18|P0007|1||
P0023|葉樹菜|19|P0022|1|(未見續記)|
P0024|葉秋榮|19|P0022|1||
P0025|葉臥丁|20|P0024|1||
P0026|葉舜|20|P0024|1||
P0027|葉樹碧|19|P0022|1||
P0028|葉水炎|20|P0027|1||
P0029|葉臥丙|20|P0027|1||
P0030|葉臥成|20|P0027|1||
P0031|葉阿賜|20|P0027|1||
P0032|葉梓福|20|P0027|1|姓名於 PDF 跨行：葉梓／福。|
P0033|葉賢能|18|P0007|1||
P0034|葉國芳|19|P0033|1|(傳女)|
P0035|葉玉極|20|P0034|1||
P0036|葉含笑|20|P0034|1||
P0037|葉國源|19|P0033|1||
P0038|葉文平|20|P0037|1||
P0039|葉阿德|20|P0037|1||
P0040|葉水金|20|P0037|1||
P0041|葉石泉|18|P0007|1|(未見續記)|
P0042|葉石水|18|P0007|1||
P0043|葉國裕|19|P0042|1|(傳女)|
P0044|葉秀美|20|P0043|1||
P0045|葉海蝦之父輩|16||1|[第十六世推測]；原文非具名人物，僅為父輩推測記載。|
P0046|葉海蝦|17||1|(第三房)|
P0047|葉條枝|18|P0046|1|(未見續記)|
P0048|葉阿旺|18|P0046|1|(未見續記)|
P0049|葉旺條|18|P0046|1||
P0050|葉俊良|19|P0049|1|（忠雄 ）|忠雄
P0051|葉作榮|20|P0050|1||
P0052|葉宗頷|21|P0051|1||
P0053|葉峻宏|20|P0050|1|（崑利）|崑利
P0054|葉宣亨|21|P0053|1||
P0055|葉姿昀|20|P0050|1|(女)；原文姓名前有「、」。|
P0056|葉進益|19|P0049|1||
P0057|葉惠真|20|P0056|1|(女)|
P0058|葉青林|20|P0056|1||
P0059|葉秋瓶|20|P0056|1|(女)|
P0060|葉秋梅|20|P0056|1|(女)；女字註記於下一行。|
P0061|葉進來|19|P0049|1|子女記載延續至第 2 頁。|
P0062|葉怡寧|20|P0061|1|(女)|
P0063|葉家華|20|P0061|2||
P0064|葉豫澤|21|P0063|2||
P0065|葉羽婕|21|P0063|2|(女)|
P0066|葉駿緯|20|P0061|2||
P0067|葉博凱|21|P0066|2||
P0068|葉宸宇|21|P0066|2||
P0069|葉進生|19|P0049|2|─ [第二十世] (未見續記)|
P0070|葉守|19|P0049|2|(女)|
P0071|葉阿香|19|P0049|2|(女)|
P0072|葉阿蜜|19|P0049|2|(女)|
P0073|葉彩雲|19|P0049|2|(女)|
P0074|葉惠美|19|P0049|2|(女)|
P0075|葉門桂|19|P0049|2|(女)|
'''


def build():
    existing = ROOT / 'data/family.json'
    if existing.exists() and json.loads(existing.read_text(encoding='utf-8')).get('confirmations'):
        raise ValueError('已有家族補充確認資料，禁止以初始 PDF 登錄表覆寫；請直接維護 family.json。')
    if hashlib.sha256(PDF.read_bytes()).hexdigest() != AUDITED_SHA256:
        raise ValueError('PDF 與本次核對版本不同，請重新人工核對登錄表，不可沿用舊關係。')
    people, relations = [], []
    for raw in REGISTER.strip().splitlines():
        pid, name, gen, parent, page, note, alias = raw.split('|')
        person = dict(id=pid, name=name, aliases=[alias] if alias else [],
                      generation=int(gen) if gen else None, fatherId=None, motherId=None,
                      parentIds=[parent] if parent else [], spouseIds=[], photo=None,
                      birthDate=None, deathDate=None, biography='', notes=note,
                      gender='female' if '(女)' in note else None,
                      branchId='B01' if int(pid[1:]) < 45 else 'B02',
                      recordType='ancestor-note' if pid == 'P0045' else 'person',
                      generationStatus='inferred' if pid == 'P0045' else ('explicit' if gen else 'unknown'),
                      source={'page': int(page), 'label': name + note})
        if pid == 'P0001':
            person['reviewNotes'] = '「葉公名妻」照錄原文；姓名用字及「名妻」意義待家族核對。'
        if pid in ('P0034', 'P0043'):
            person['reviewNotes'] = '「傳女」意義待考證；保留原註，不逕行解讀為性別、收養或婚姻。'
        if pid == 'P0045':
            person['reviewNotes'] = '父輩不是已確認的父親；不納入確定的親子連線，亦不與另一支系連接。'
        people.append(person)
        if parent:
            relations.append(dict(id=f'R-{parent}-{pid}', type='parent-child',
                                  fromId=parent, toId=pid, role='unspecified',
                                  status='source-supported',
                                  source={'pages': [1, 2] if pid == 'P0063' or pid == 'P0066' else [int(page)],
                                          'evidence': '原文樹狀縮排／連線及相鄰世代；未註明父母角色。'}))
    by_id = {p['id']: p for p in people}
    for a, b in [('P0001', 'P0002'), ('P0007', 'P0008')]:
        by_id[a]['spouseIds'].append(b)
        by_id[b]['spouseIds'].append(a)
        relations.append(dict(id=f'S-{a}-{b}', type='spouse', fromId=a, toId=b,
                              status='source-supported', source={'pages': [1], 'evidence': '原文以「＝」並列記載。'}))
    relations.append(dict(id='U01', type='possible-ancestor', fromId='P0045', toId='P0046',
                          status='pending', source={'pages': [1], 'evidence': '原文「[第十六世推測] 葉海蝦之父輩」。'},
                          note='僅為父輩推測，並非可確認的父親，禁止當作確定親子連線。'))
    review_items = [
        {'id': 'Q01', 'personIds': ['P0045', 'P0046'], 'text': '葉海蝦父輩與第十六世身分均待考證，與葉公名妻支系無明確血緣證據。'},
        {'id': 'Q02', 'personIds': ['P0001'], 'text': '葉公名妻：姓名照錄；「名妻」用字與意義待確認。'},
        {'id': 'Q03', 'personIds': ['P0034', 'P0043'], 'text': '「傳女」保留原文，意義待確認，不推定性別或收養。'},
        {'id': 'Q04', 'personIds': ['P0069'], 'text': '葉進生後僅有「[第二十世] (未見續記)」，沒有姓名，不建立虛構人物。'},
        {'id': 'Q05', 'personIds': ['P0002', 'P0008'], 'text': '兩位配偶沒有獨立標註世代，generation 保持 null，僅隨配偶並排。'},
    ]
    data = {'schemaVersion': 1, 'title': '葉氏家族族譜', 'ancestralHome': '福建漳州府海澄縣',
            'source': {'file': PDF.name, 'pages': 2, 'sha256': hashlib.sha256(PDF.read_bytes()).hexdigest(),
                       'method': '兩頁全文擷取與逐頁版面人工核對；非依姓名或橫向位置推測親屬。'},
            'branches': [{'id': 'B01', 'name': '葉公名妻支系', 'rootIds': ['P0001'], 'description': '原文第十六世起之記載'},
                         {'id': 'B02', 'name': '葉海蝦支系', 'rootIds': ['P0045', 'P0046'], 'description': '原文註記「第三房」；父輩待考證'}],
            'people': people, 'relationships': relations, 'reviewItems': review_items,
            'unparsed': [{'page': 2, 'text': '[第二十世] (未見續記)', 'reason': '無具名後代，不建立人物。'}]}
    (ROOT / 'data/family.json').write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    counts = Counter(p['generation'] for p in people if p['recordType'] == 'person')
    print(json.dumps({'records': len(people), 'namedPeople': len(people) - 1,
                      'generations': dict(sorted((str(k), v) for k, v in counts.items())),
                      'parentRelations': sum(r['type'] == 'parent-child' for r in relations),
                      'spousePairs': 2, 'pendingRelations': 1}, ensure_ascii=False))


if __name__ == '__main__':
    build()
