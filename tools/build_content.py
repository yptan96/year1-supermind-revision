# -*- coding: utf-8 -*-
"""Writes data.js (window.CONTENT = {...}) from the word and sentence lists below.
Source of words: SJK Year 1 Scheme of Work (lessons 1-77). Run:  python tools/build_content.py
"""
import json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# (id, en, bm, zh, img, kind)   img=None -> numeral tile
def I(id, en, bm, zh, kind, img=None, **kw):
    d = dict(id=id, en=en, bm=bm, zh=zh, kind=kind, img=img if img is not None else id)
    d.update(kw)
    return d

NUM_BM = ['satu','dua','tiga','empat','lima','enam','tujuh','lapan','sembilan','sepuluh','sebelas','dua belas','tiga belas','empat belas','lima belas','enam belas','tujuh belas','lapan belas','sembilan belas','dua puluh']
NUM_ZH = ['一','二','三','四','五','六','七','八','九','十','十一','十二','十三','十四','十五','十六','十七','十八','十九','二十']
NUM_EN = ['one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen','twenty']

def nums(a, b):
    return [I('n%d' % n, NUM_EN[n-1], NUM_BM[n-1], NUM_ZH[n-1], 'number', img='', num=n) for n in range(a, b+1)]

U0 = [
    I('blue', 'blue', 'biru', '蓝色', 'colour'),
    I('green', 'green', 'hijau', '绿色', 'colour'),
    I('yellow', 'yellow', 'kuning', '黄色', 'colour'),
    I('red', 'red', 'merah', '红色', 'colour'),
    I('white', 'white', 'putih', '白色', 'colour'),
    I('boy', 'boy', 'budak lelaki', '男孩', 'person'),
    I('girl', 'girl', 'budak perempuan', '女孩', 'person'),
    I('hat', 'hat', 'topi', '帽子', 'thing'),
] + nums(1, 10)

U1 = [
    I('pen', 'pen', 'pen', '笔', 'thing'),
    I('pencil', 'pencil', 'pensel', '铅笔', 'thing'),
    I('ruler', 'ruler', 'pembaris', '尺子', 'thing'),
    I('rubber', 'rubber', 'pemadam', '橡皮擦', 'thing'),
    I('bag', 'bag', 'beg', '书包', 'thing'),
    I('book', 'book', 'buku', '书', 'thing'),
    I('desk', 'desk', 'meja', '课桌', 'thing'),
    I('chair', 'chair', 'kerusi', '椅子', 'thing'),
    I('pencil-case', 'pencil case', 'bekas pensel', '铅笔盒', 'thing'),
    I('orange-c', 'orange', 'oren', '橙色', 'colour', img='orange-colour'),
    I('purple', 'purple', 'ungu', '紫色', 'colour'),
    I('sit', 'sit', 'duduk', '坐下', 'action', cmd="Sit at your desk, please.", cmdBm="Sila duduk di meja anda.", cmdZh="请坐在你的课桌前。"),
    I('stand', 'stand', 'berdiri', '站起来', 'action', cmd="Stand up, please.", cmdBm="Sila berdiri.", cmdZh="请站起来。"),
    I('open-bag', 'open your bag', 'buka beg', '打开书包', 'action', cmd="Open your bag, please.", cmdBm="Sila buka beg anda.", cmdZh="请打开你的书包。"),
    I('put-away-book', 'put away your book', 'simpan buku', '收好书', 'action', cmd="Put away your book.", cmdBm="Simpan buku anda.", cmdZh="把书收起来。"),
    I('look', 'look at the board', 'lihat papan', '看黑板', 'action', cmd="Look at the board.", cmdBm="Lihat papan hitam.", cmdZh="看黑板。"),
    I('turn-around', 'turn around', 'pusing', '转过身', 'action', cmd="Turn around.", cmdBm="Pusing ke belakang.", cmdZh="转过身。"),
    I('stretch', 'stretch', 'regangkan badan', '伸展', 'action', cmd="Stretch.", cmdBm="Regangkan badan.", cmdZh="伸展身体。"),
    I('catch', 'catch', 'tangkap', '接住', 'action', cmd="Catch the ball.", cmdBm="Tangkap bola itu.", cmdZh="接住球。"),
    I('cut-out', 'cut out', 'gunting', '剪下来', 'action', cmd="Cut out.", cmdBm="Gunting.", cmdZh="剪下来。"),
    I('fold', 'fold', 'lipat', '折', 'action', cmd="Fold the paper.", cmdBm="Lipat kertas itu.", cmdZh="把纸折起来。"),
    I('glue', 'glue', 'tampal', '粘贴', 'action', cmd="Glue it.", cmdBm="Tampal.", cmdZh="粘上去。"),
]

U2 = [
    I('kite', 'kite', 'layang-layang', '风筝', 'toy'),
    I('doll', 'doll', 'anak patung', '洋娃娃', 'toy'),
    I('monster', 'monster', 'raksasa', '怪物', 'toy'),
    I('plane', 'plane', 'kapal terbang', '飞机', 'toy'),
    I('ball', 'ball', 'bola', '球', 'toy'),
    I('bike', 'bike', 'basikal', '自行车', 'toy'),
    I('go-kart', 'go-kart', 'kart', '卡丁车', 'toy'),
    I('computer-game', 'computer game', 'permainan komputer', '电脑游戏', 'toy'),
    I('train', 'train', 'kereta api', '火车', 'toy'),
    I('car', 'car', 'kereta', '汽车', 'toy'),
    I('long', 'long', 'panjang', '长', 'adj'),
    I('short', 'short', 'pendek', '短', 'adj'),
    I('big', 'big', 'besar', '大', 'adj'),
    I('small', 'small', 'kecil', '小', 'adj'),
    I('old', 'old', 'lama', '旧', 'adj'),
    I('new', 'new', 'baru', '新', 'adj'),
    I('beautiful', 'beautiful', 'cantik', '漂亮', 'adj'),
    I('ugly', 'ugly', 'hodoh', '丑', 'adj'),
    I('triangle', 'triangle', 'segi tiga', '三角形', 'shape'),
    I('square', 'square', 'segi empat sama', '正方形', 'shape'),
    I('circle', 'circle', 'bulatan', '圆形', 'shape'),
    I('rectangle', 'rectangle', 'segi empat tepat', '长方形', 'shape'),
    I('parallelogram', 'parallelogram', 'segi empat selari', '平行四边形', 'shape'),
    I('tangram', 'tangram', 'tangram', '七巧板', 'shape'),
]

U3 = [
    I('elephant', 'elephant', 'gajah', '大象', 'animal'),
    I('rat', 'rat', 'tikus', '老鼠', 'animal'),
    I('lizard', 'lizard', 'cicak', '蜥蜴', 'animal'),
    I('frog', 'frog', 'katak', '青蛙', 'animal'),
    I('spider', 'spider', 'labah-labah', '蜘蛛', 'animal'),
    I('duck', 'duck', 'itik', '鸭子', 'animal'),
    I('dog', 'dog', 'anjing', '狗', 'animal'),
    I('cat', 'cat', 'kucing', '猫', 'animal'),
    I('pet-show', 'pet show', 'pertunjukan haiwan peliharaan', '宠物展', 'scene'),
    I('snake', 'snake', 'ular', '蛇', 'animal'),
    I('crocodile', 'crocodile', 'buaya', '鳄鱼', 'animal'),
    I('butterfly', 'butterfly', 'rama-rama', '蝴蝶', 'animal'),
    I('tiger', 'tiger', 'harimau', '老虎', 'animal'),
    I('giraffe', 'giraffe', 'zirafah', '长颈鹿', 'animal'),
    I('grass', 'grass', 'rumput', '草', 'nature'),
    I('leaf', 'leaf', 'daun', '叶子', 'nature'),
    I('ground', 'ground', 'tanah', '地面', 'nature'),
    I('face', 'face', 'muka', '脸', 'body'),
    I('eyes', 'eyes', 'mata', '眼睛', 'body'),
    I('nose', 'nose', 'hidung', '鼻子', 'body'),
    I('mask', 'mask', 'topeng', '面具', 'thing'),
    I('paper-plate', 'paper plate', 'pinggan kertas', '纸盘', 'thing'),
    I('in', 'in', 'di dalam', '在里面', 'prep'),
    I('on', 'on', 'di atas', '在上面', 'prep'),
    I('under', 'under', 'di bawah', '在下面', 'prep'),
]

U4 = [
    I('banana', 'banana', 'pisang', '香蕉', 'food'),
    I('cake', 'cake', 'kek', '蛋糕', 'food'),
    I('cheese', 'cheese', 'keju', '芝士', 'food'),
    I('sandwich', 'sandwich', 'sandwic', '三明治', 'food'),
    I('apple', 'apple', 'epal', '苹果', 'food'),
    I('pizza', 'pizza', 'piza', '比萨', 'food'),
    I('sausage', 'sausage', 'sosej', '香肠', 'food'),
    I('chicken', 'chicken', 'ayam', '鸡肉', 'food'),
    I('steak', 'steak', 'stik', '牛排', 'food'),
    I('peas', 'peas', 'kacang pis', '豌豆', 'food'),
    I('carrots', 'carrots', 'lobak merah', '红萝卜', 'food'),
    I('hot-dog', 'hot dog', 'hot dog', '热狗', 'food'),
    I('milk', 'milk', 'susu', '牛奶', 'food'),
    I('juice', 'juice', 'jus', '果汁', 'food'),
    I('kitchen', 'kitchen', 'dapur', '厨房', 'scene'),
    I('broccoli', 'broccoli', 'brokoli', '西兰花', 'food'),
    I('onion', 'onion', 'bawang', '洋葱', 'food'),
    I('green-beans', 'green beans', 'kacang buncis', '青豆', 'food'),
    I('mushroom', 'mushroom', 'cendawan', '蘑菇', 'food'),
    I('potato', 'potato', 'kentang', '马铃薯', 'food'),
    I('corn', 'corn', 'jagung', '玉米', 'food'),
    I('peach', 'peach', 'pic', '桃子', 'food'),
    I('pineapple', 'pineapple', 'nanas', '菠萝', 'food'),
    I('pear', 'pear', 'pear', '梨', 'food'),
    I('orange', 'orange', 'oren', '橙', 'food'),
    I('coconut', 'coconut', 'kelapa', '椰子', 'food'),
    I('tomato', 'tomato', 'tomato', '番茄', 'food'),
    I('strawberry', 'strawberry', 'strawberi', '草莓', 'food'),
] + nums(11, 20)

def S(id, en, bm, zh, item=None):
    d = dict(id=id, en=en, bm=bm, zh=zh)
    if item: d['item'] = item
    return d

SENT = {
 0: [
  S('s0-1', "Hi! What's your name?", 'Hai! Siapa nama awak?', '你好！你叫什么名字？'),
  S('s0-2', "I'm Ben.", 'Saya Ben.', '我是 Ben。', 'boy'),
  S('s0-3', "He's a boy.", 'Dia budak lelaki.', '他是男孩。', 'boy'),
  S('s0-4', "She's a girl.", 'Dia budak perempuan.', '她是女孩。', 'girl'),
  S('s0-5', 'My hat is yellow.', 'Topi saya berwarna kuning.', '我的帽子是黄色的。', 'hat'),
  S('s0-6', 'How old are you?', 'Berapa umur awak?', '你几岁？'),
  S('s0-7', "I'm six years old.", 'Saya berumur enam tahun.', '我六岁。'),
  S('s0-8', 'Point to something green.', 'Tunjuk sesuatu yang berwarna hijau.', '请指一样绿色的东西。', 'green'),
  S('s0-9', 'How do you spell your name?', 'Bagaimana awak mengeja nama awak?', '你的名字怎么拼？'),
  S('s0-10', 'Bye!', 'Selamat tinggal!', '再见！'),
 ],
 1: [
  S('s1-1', "What's this?", 'Apakah ini?', '这是什么？'),
  S('s1-2', "It's a ruler.", 'Ini sebuah pembaris.', '这是一把尺子。', 'ruler'),
  S('s1-3', "It's a pen.", 'Ini sebatang pen.', '这是一支笔。', 'pen'),
  S('s1-4', "It's a book.", 'Ini sebuah buku.', '这是一本书。', 'book'),
  S('s1-5', 'Is it a bag?', 'Adakah ini sebuah beg?', '这是书包吗？', 'bag'),
  S('s1-6', 'Yes, it is.', 'Ya, betul.', '是的，它是。'),
  S('s1-7', "No, it isn't.", 'Tidak, bukan.', '不，它不是。'),
  S('s1-8', "It isn't my pen.", 'Ini bukan pen saya.', '这不是我的笔。', 'pen'),
  S('s1-9', 'Open your bag, please.', 'Sila buka beg anda.', '请打开你的书包。', 'open-bag'),
  S('s1-10', 'Sit at your desk, please.', 'Sila duduk di meja anda.', '请坐在你的课桌前。', 'sit'),
  S('s1-11', 'Look at the board.', 'Lihat papan hitam.', '看黑板。', 'look'),
  S('s1-12', "Here's your pencil case.", 'Ini bekas pensel awak.', '这是你的铅笔盒。', 'pencil-case'),
  S('s1-13', 'Thank you.', 'Terima kasih.', '谢谢。'),
  S('s1-14', "I'm sorry.", 'Maaf.', '对不起。'),
 ],
 2: [
  S('s2-1', "It's a kite.", 'Ini sebuah layang-layang.', '这是一个风筝。', 'kite'),
  S('s2-2', "It's a doll.", 'Ini sebuah anak patung.', '这是一个洋娃娃。', 'doll'),
  S('s2-3', "It's a big ball.", 'Ini bola yang besar.', '这是一个大球。', 'big'),
  S('s2-4', "It's a small ball.", 'Ini bola yang kecil.', '这是一个小球。', 'small'),
  S('s2-5', "It's an old bear.", 'Ini beruang yang lama.', '这是一只旧熊。', 'old'),
  S('s2-6', "It's a new bear.", 'Ini beruang yang baru.', '这是一只新熊。', 'new'),
  S('s2-7', "It's a beautiful doll.", 'Ini anak patung yang cantik.', '这是一个漂亮的洋娃娃。', 'beautiful'),
  S('s2-8', "It's an ugly monster.", 'Ini raksasa yang hodoh.', '这是一只丑怪物。', 'ugly'),
  S('s2-9', 'My favourite toy is a bike.', 'Mainan kegemaran saya ialah basikal.', '我最喜欢的玩具是自行车。', 'bike'),
  S('s2-10', "What's your favourite toy?", 'Apakah mainan kegemaran awak?', '你最喜欢的玩具是什么？'),
  S('s2-11', "It's a circle.", 'Ini sebuah bulatan.', '这是一个圆形。', 'circle'),
  S('s2-12', "That's great!", 'Hebatnya!', '太棒了！'),
 ],
 3: [
  S('s3-1', 'The cat is in the box.', 'Kucing itu di dalam kotak.', '猫在盒子里面。', 'in'),
  S('s3-2', 'The cat is on the box.', 'Kucing itu di atas kotak.', '猫在盒子上面。', 'on'),
  S('s3-3', 'The cat is under the table.', 'Kucing itu di bawah meja.', '猫在桌子下面。', 'under'),
  S('s3-4', "It's a frog.", 'Ini seekor katak.', '这是一只青蛙。', 'frog'),
  S('s3-5', 'I like dogs.', 'Saya suka anjing.', '我喜欢狗。', 'dog'),
  S('s3-6', "I don't like spiders.", 'Saya tidak suka labah-labah.', '我不喜欢蜘蛛。', 'spider'),
  S('s3-7', 'I like ducks.', 'Saya suka itik.', '我喜欢鸭子。', 'duck'),
  S('s3-8', 'The tiger hides in the grass.', 'Harimau bersembunyi di dalam rumput.', '老虎躲在草丛里。', 'tiger'),
  S('s3-9', 'Look at the elephant.', 'Lihat gajah itu.', '看那头大象。', 'elephant'),
  S('s3-10', 'Do you like cats?', 'Adakah awak suka kucing?', '你喜欢猫吗？', 'cat'),
  S('s3-11', 'Come back!', 'Datang balik!', '回来！'),
  S('s3-12', "I've got an idea!", 'Saya ada idea!', '我有一个主意！'),
 ],
 4: [
  S('s4-1', "What's for lunch?", 'Apa untuk makan tengah hari?', '午餐吃什么？'),
  S('s4-2', 'I like pizza.', 'Saya suka piza.', '我喜欢比萨。', 'pizza'),
  S('s4-3', "I don't like carrots.", 'Saya tidak suka lobak merah.', '我不喜欢红萝卜。', 'carrots'),
  S('s4-4', 'Do you like cheese?', 'Adakah awak suka keju?', '你喜欢芝士吗？', 'cheese'),
  S('s4-5', 'Yes, I do.', 'Ya, saya suka.', '是的，我喜欢。'),
  S('s4-6', "No, I don't.", 'Tidak, saya tidak suka.', '不，我不喜欢。'),
  S('s4-7', "I've got a sandwich.", 'Saya ada sebiji sandwic.', '我有一个三明治。', 'sandwich'),
  S('s4-8', "I've got an apple.", 'Saya ada sebiji epal.', '我有一个苹果。', 'apple'),
  S('s4-9', "I haven't got a banana.", 'Saya tidak ada pisang.', '我没有香蕉。', 'banana'),
  S('s4-10', 'What have you got?', 'Awak ada apa?', '你有什么？'),
  S('s4-11', 'I like milk.', 'Saya suka susu.', '我喜欢牛奶。', 'milk'),
  S('s4-12', 'Three times two is six.', 'Tiga darab dua ialah enam.', '三乘二等于六。'),
  S('s4-13', 'Eleven and seven is eighteen.', 'Sebelas campur tujuh ialah lapan belas.', '十一加七等于十八。'),
 ],
}

UNITS = [
 dict(id=0, name='Friends', short='Unit 0', sub='Hello, colours, numbers', bg='#FFD8D8', ink='#B02A2A', items=U0),
 dict(id=1, name='At School', short='Unit 1', sub='Classroom, actions', bg='#CDE7FF', ink='#1A5FA8', items=U1),
 dict(id=2, name='Let\'s Play!', short='Unit 2', sub='Toys, shapes', bg='#FFF0A8', ink='#7A6200', items=U2),
 dict(id=3, name='Pet Show', short='Unit 3', sub='Animals, in/on/under', bg='#CDF5D3', ink='#1D6B2C', items=U3),
 dict(id=4, name='Lunchtime', short='Unit 4', sub='Food, numbers 11-20', bg='#FFE0BD', ink='#8A4A00', items=U4),
]

def spellable(it):
    w = it['en']
    return bool(re.fullmatch(r'[a-z]+', w)) and 3 <= len(w) <= 10 and it['kind'] not in ('action', 'prep', 'scene')

for u in UNITS:
    for it in u['items']:
        it['unit'] = u['id']
        it['spell'] = spellable(it)
    u['sentences'] = [dict(s, unit=u['id']) for s in SENT[u['id']]]

SKILLS = [
 dict(id='listen', label='Listen', dskp='Listening', std=['1.1.1', '1.2.2', '1.2.4', '1.2.5']),
 dict(id='speak', label='Speak', dskp='Speaking', std=['2.1.1', '2.1.4', '2.1.5']),
 dict(id='read', label='Read', dskp='Reading', std=['3.2.1', '3.2.2', '3.3.1']),
 dict(id='write', label='Write', dskp='Writing', std=['4.1.2', '4.3.2']),
 dict(id='sent', label='Sentences', dskp='Writing', std=['4.2.1', '4.2.2', '4.2.4', '4.3.1']),
 dict(id='sound', label='Sounds', dskp='Reading', std=['3.1.1', '3.1.2', '3.1.3', '3.1.4']),
 dict(id='words', label='Words', dskp='Reading', std=['3.2.1', '3.3.1']),
]

STD_TITLES = {
 '1.1.1': 'Recognise and reproduce phonemes', '1.2.2': 'Understand specific information in simple phrases and sentences',
 '1.2.4': 'Understand classroom instructions', '1.2.5': 'Understand short questions',
 '2.1.1': 'Give basic personal information', '2.1.4': 'Greet, say goodbye, say thanks', '2.1.5': 'Name or describe objects',
 '3.1.1': 'Recognise letter shapes', '3.1.2': 'Sound out beginning, medial, final sounds', '3.1.3': 'Blend phonemes (CVC, CCVC)',
 '3.1.4': 'Segment phonemes (CVC, CCVC)', '3.2.1': 'Understand the main idea of simple phrases and sentences',
 '3.2.2': 'Understand specific details in simple phrases and sentences', '3.3.1': 'Read simple print and digital games at word level',
 '4.1.2': 'Form letters, write in a straight line, copy words correctly', '4.2.1': 'Give basic personal information in writing',
 '4.2.2': 'Greet, say goodbye, say thanks in writing', '4.2.4': 'Name or describe objects in writing',
 '4.3.1': 'Use capital letters in names', '4.3.2': 'Spell familiar high frequency words',
}

# Official DSKP KSSR BI Year 1 SJK, "Performance Standards Guide for ... Skills" (Listening p26, Speaking p30-31, Reading p37, Writing p43)
TPD = {
 'Listening': {
  1: 'Hardly recognises and reproduces limited target language phonemes. Hardly understands very simple questions, instructions and main ideas of the texts even with a lot of support from the teacher.',
  2: 'Recognises and reproduces some limited target language phonemes with a lot of support from the teacher. Understands a few very simple questions, instructions and main ideas of the texts with a lot of support from the teacher.',
  3: 'Recognises and reproduces limited target language phonemes with support from the teacher. Understands very simple questions, instructions, main ideas and supporting details of the texts with support from the teacher. Predicts words using knowledge of a topic with support from the teacher.',
  4: 'Recognises and reproduces limited target language phonemes with minimal support from the teacher. Understands very simple questions, instructions, main ideas and supporting details of the texts with minimal support from the teacher. Predicts words using knowledge of a topic.',
  5: 'Recognises and reproduces target language phonemes appropriately. Understands simple questions, instructions, main ideas and supporting details of the texts without hesitation. Displays increasing confidence and self-reliance in predicting words using knowledge of a topic.',
  6: 'Recognises and reproduces target language phonemes appropriately and independently. Understands simple questions, instructions, main ideas and supporting details of the texts promptly and independently. Predicts words using knowledge of a topic confidently and independently.'},
 'Speaking': {
  1: 'Hardly produces meaningful words and fixed phrases even with a lot of support from the teacher. Hardly asks and answers straightforward questions using one word or a fixed phrase even with a lot of support from the teacher.',
  2: 'Produces a few meaningful words and fixed phrases with a lot of support from the teacher. Asks and answers a few straightforward questions using one word or a fixed phrase with a lot of support from the teacher.',
  3: 'Produces and comprehends words and fixed phrases on very familiar topics with some support from the teacher. Asks and answers straightforward questions using one word or a fixed phrase with some support from the teacher. Introduces self, describes objects and participates in simple interactions on familiar topics using fixed phrases.',
  4: 'Produces and comprehends words and fixed phrases on very familiar topics with minimal support from the teacher. Asks and answers straightforward questions using one word or a fixed phrase with minimal support from the teacher. Expresses self, describes objects and participates in simple conversations on familiar topics using fixed phrases.',
  5: 'Produces and comprehends words and fixed phrases on very familiar topics confidently. Asks and answers straightforward questions using one word or a fixed phrase with increasing confidence and self-reliance. Expresses self, describes objects and participates in conversations on familiar topics using fixed phrases with an increasing display of confidence.',
  6: 'Produces and comprehends words and fixed phrases on very familiar topics confidently and independently. Asks and answers straightforward questions using fixed phrases with ease and great confidence. Initiates, expresses self, describes objects and participates in conversations on familiar topics using fixed phrases independently. Displays exemplary model of language use to others.'},
 'Reading': {
  1: 'Hardly identifies and recognises shapes of the letters in the alphabet even with a lot of support from the teacher. Hardly blends and segments phonemes (CVC, CCVC) even with a lot of support from the teacher.',
  2: 'Identifies and recognises most shapes of the letters in the alphabet with a lot of support from the teacher. Blends and segments a few phonemes (CVC, CCVC) with a lot of support from the teacher. Hardly understands main ideas of very simple phrases and sentences after repeated readings.',
  3: 'Identifies and recognises all shapes of the letters in the alphabet. Blends and segments phonemes (CVC, CCVC) with support from the teacher. Understands main ideas, specific information and details of very simple phrases and sentences. Uses picture dictionary to categorise words with support from the teacher.',
  4: 'Blends and segments phonemes (CVC, CCVC) without hesitation. Understands main ideas, specific information and details of very simple phrases and sentences appropriately. Uses picture dictionary to categorise words with minimal support from the teacher.',
  5: 'Uses phonics to read words and identify word families confidently. Understands main ideas, specific information and details of very simple phrases and sentences confidently. Uses picture dictionary to categorise words confidently.',
  6: 'Uses phonics to read words and identify word families independently. Understands main ideas, specific information and details of simple sentences independently. Uses picture dictionary to categorise words independently.'},
 'Writing': {
  1: 'Hardly displays early writing skills to form letters as demonstrated by the teacher. Hardly uses fixed phrases to communicate with appropriate language form and style even with a lot of support from the teacher.',
  2: 'Displays early writing skills to form letters as demonstrated by the teacher with some legibility. Uses fixed phrases to communicate with appropriate language form and style with a lot of support from the teacher.',
  3: "Displays early writing skills appropriately. Writes comprehensible words and phrases with correct punctuation and spelling supported by the teacher. Organises words by using 'and' to communicate with appropriate language form and style with some support from the teacher.",
  4: "Writes comprehensible words and phrases with correct punctuation and spelling with minimal support by the teacher. Organises words by using 'and' to communicate with appropriate language form and style with minimal support from the teacher.",
  5: "Writes comprehensible words and phrases with correct punctuation and spelling confidently. Organises words by using 'and' to communicate with appropriate language form and style without hesitation.",
  6: "Writes comprehensible words and phrases with correct punctuation and spelling independently. Organises words by using 'and' to communicate with appropriate language form and style independently. Displays exemplary model of language use to others."},
}
TPN = {1: 'Requires support to achieve curriculum target (Working towards A1)', 2: 'On track to achieve curriculum target (Working towards A1)',
       3: 'Achieves expectations of curriculum target (Working towards A1)', 4: 'Working towards exceeding expectations (A1 Low)',
       5: 'On track to exceed expectations (A1 Low)', 6: 'Exceeds expectations (A1 Low)'}

# ---------------------------------------------------------------------------------------------------------------
# "Write it" (handwriting): sentence frames from the teacher's own question documents.
# Easy = copy, Medium = put jumbled words in order and write the sentence, Challenge = write your own sentence from the picture.
# ---------------------------------------------------------------------------------------------------------------
PAL = json.load(open(os.path.join(ROOT, 'tools', 'palettes.json'), encoding='utf8')) if os.path.exists(os.path.join(ROOT, 'tools', 'palettes.json')) else {}
ITEM = {it['id']: it for u in UNITS for it in u['items']}
def img_ok(key): return os.path.exists(os.path.join(ROOT, 'img', key + '.png'))
NOUNS = {}
def noun(key, text=None, syn=None, img=None):
    """key = picture name. img=None -> same as key. A noun with no picture file yet is shown as a word until the picture arrives."""
    if key in NOUNS: return key
    en = text or (ITEM[key]['en'] if key in ITEM else key.replace('-', ' '))
    NOUNS[key] = dict(noun=en, syn=syn or [], img=(img or key) if img_ok(img or key) else None, pal=PAL.get(img or key, []), file=(img or key))
    return key
def art(w): return 'an' if w[0] in 'aeiou' else 'a'

WRITEIT = []
POS = [('cat', 'desk', 'on'), ('spider', 'pencil-case', 'in'), ('ball', 'bag', 'under'), ('frog', 'book', 'on'), ('ruler', 'notebook', 'in'), ('lizard', 'car', 'under'),
       ('doll', 'go-kart', 'on'), ('rat', 'desk', 'in'), ('plane', 'desk', 'under'), ('duck', 'bike', 'on'), ('pencil', 'bag', 'in'), ('monster', 'train', 'under'),
       ('rubber', 'computer-game', 'on'), ('elephant', 'kite', 'under'), ('dog', 'car', 'in'), ('notebook', 'ruler', 'on'), ('spider', 'rubber', 'under'),
       ('frog', 'notebook', 'in'), ('ball', 'elephant', 'on'), ('cat', 'doll', 'under')]
for n, (a, b, prep) in enumerate(POS, 1):
    noun(a); noun(b)
    WRITEIT.append(dict(id='p%02d' % n, kind='pos', unit=3, a=a, b=b, prep=prep, scene='scene-%02d' % n,
                        model='The %s is %s the %s.' % (NOUNS[a]['noun'], prep, NOUNS[b]['noun'])))
HAVE = [('sandwich', 'cheese ', 'a'), ('apple', '', 'an'), ('banana', '', 'a'), ('carrots', '', 'a'), ('pizza', '', 'a'), ('pencil', '', 'a'), ('ruler', '', 'a'), ('doll', '', 'a'), ('monster', 'ugly ', 'an'), ('frog', '', 'a')]
HAVENT = [('steak', 'a'), ('cake', 'a'), ('sausage', 'a'), ('chicken', 'a'), ('pen', 'a'), ('notebook', 'a'), ('pencil-case', 'a'), ('train', 'a'), ('bike', 'a'), ('elephant', 'an')]
for n, (k, mod, ar) in enumerate(HAVE, 1):
    if k == 'carrots': noun('carrots', 'carrot', syn=['carrots'])
    else: noun(k)
    WRITEIT.append(dict(id='h%02d' % n, kind='have', unit=4, x=k, model='I have got %s %s%s.' % (ar, mod, NOUNS[k]['noun'])))
for n, (k, ar) in enumerate(HAVENT, 1):
    noun(k)
    WRITEIT.append(dict(id='n%02d' % n, kind='havent', unit=4, x=k, model="I haven't got %s %s." % (ar, NOUNS[k]['noun'])))
for k in ['pen', 'pencil', 'ruler', 'rubber', 'bag', 'book', 'desk', 'chair', 'pencil-case']:
    noun(k); WRITEIT.append(dict(id='i_' + k, kind='its', unit=1, x=k, model="It's %s %s." % (art(NOUNS[k]['noun']), NOUNS[k]['noun'])))
for k in ['kite', 'doll', 'monster', 'plane', 'ball', 'bike', 'go-kart', 'computer-game', 'train', 'car']:
    noun(k); WRITEIT.append(dict(id='i_' + k, kind='its', unit=2, x=k, model="It's %s %s." % (art(NOUNS[k]['noun']), NOUNS[k]['noun'])))
for k in ['elephant', 'rat', 'lizard', 'frog', 'spider', 'duck', 'dog', 'cat']:
    noun(k); WRITEIT.append(dict(id='i_' + k, kind='its', unit=3, x=k, model="It's %s %s." % (art(NOUNS[k]['noun']), NOUNS[k]['noun'])))
missing_pics = sorted({v['file'] for v in NOUNS.values() if not v['img']})
print('write-it frames', len(WRITEIT), '| nouns', len(NOUNS), '| pictures still to come:', missing_pics)
SKILLS.append(dict(id='writeit', label='Write it', dskp='Writing', std=['4.1.2', '4.2.1', '4.2.4', '4.3.1', '4.3.2']))

CONTENT = dict(units=UNITS, skills=SKILLS, stdTitles=STD_TITLES, tpDescriptors=TPD, tpNotes=TPN, writeit=dict(frames=WRITEIT, nouns=NOUNS))
with open(os.path.join(ROOT, 'data.js'), 'w', encoding='utf-8') as f:
    f.write('window.CONTENT = ' + json.dumps(CONTENT, ensure_ascii=False, indent=1) + ';\n')
n_items = sum(len(u['items']) for u in UNITS)
n_sent = sum(len(u['sentences']) for u in UNITS)
print('items', n_items, 'sentences', n_sent)

# images referenced vs. present
missing = []
for u in UNITS:
    for it in u['items']:
        if it['kind'] != 'number':
            if not os.path.exists(os.path.join(ROOT, 'img', it['img'] + '.png')):
                missing.append(it['img'])
print('missing images:', missing)
