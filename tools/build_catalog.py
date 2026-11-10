"""Genera img/products/*.jpg y js/data.js a partir de los catálogos PDF de Zares.

Uso:  python tools/build_catalog.py <ruta ZARESBEAUTY.pdf> <ruta ZARESBEAUTY-1.pdf>

Precios: may = mayorista (12 uds), min = minorista (3 y 6 uds), pvp = precio por unidad.
pvpEst = True cuando el catálogo no trae P.V.P. y se estimó (aprox. 2x mayorista):
la dueña debe confirmarlo desde el panel.
"""
import sys, json, math, os
import pymupdf as fitz

A, B = sys.argv[1], sys.argv[2]
# (pdf, pagina, id, nombre, marca, categoria, may, min, pvp|None, tonos, extra)
P = [
 # ---------- Maquillaje ----------
 ('B',4,'5622','Labial Velvet Avellana','Novo','maquillaje',1.75,1.95,None,['Avellana','Canela','Rosa vino','Berry'],{'tags':['nuevo','top']}),
 ('B',5,'5809','Lipgloss Avellana','Novo','maquillaje',1.50,1.65,None,['Avellana','Caramelo','Rosa nude','Ciruela'],{'tags':['top']}),
 ('B',7,'6476','Mirror Lip Gloss','Novo','maquillaje',1.60,1.70,None,['108','029','166','433','620','622'],{'tags':['nuevo']}),
 ('B',9,'6483','Novo Lip Gloss','Novo','maquillaje',2.00,2.20,None,['Cherry kiss','Nude amber','Peach blossom','Misty rose'],{}),
 ('B',10,'6193','Labial Velvet 2 en 1','Novo','maquillaje',1.80,1.95,None,['01','02','03','04','05','06'],{'tags':['nuevo']}),
 ('B',11,'9046','Labiales Novo','Novo','maquillaje',2.00,2.20,None,['Rosa nude','Coral','Durazno','Mauve','Berry','Chocolate'],{}),
 ('B',12,'HR692','Sweet Desires Mirror Lip Glaze','Herorange','maquillaje',2.25,2.45,None,['Coral','Melocotón','Rosa nude','Rosa malva','Fucsia','Frambuesa','Rojo cereza'],{'tags':['top']}),
 ('B',13,'HR1038','Lipgloss Herorange','Herorange','maquillaje',1.85,2.00,None,['01','02','03','04','05','06'],{}),
 ('B',14,'CZ6423','Labial 2 en 1 brillo y matte','Novo','maquillaje',1.40,1.50,None,['01','296','567','683','921','928'],{}),
 ('B',16,'HR774','Labial Herorange','Herorange','maquillaje',2.00,2.20,None,['01','02','03','04','05'],{}),
 ('B',17,'HR1010','Delineador labial y de ojos','Herorange','maquillaje',1.30,1.45,3.00,['01','02','03','04','05','06','07','08'],{}),
 ('B',2,'CZ021','Labial hidratante Karité','Karité','maquillaje',0.90,1.00,None,['01','02','03','04'],{}),
 ('B',3,'L269','Mini Tango Berry Princess','Mini Tango','maquillaje',1.40,1.55,None,[],{'tags':['nuevo']}),
 ('B',6,'L304','Super Balm POPS!','Mini Tango','maquillaje',1.50,1.65,None,['Mango kiwi','Cherry','Coconut','Blueberry'],{}),
 ('B',23,'HR736','Jelly Blush','Herorange','maquillaje',1.55,1.70,None,[],{'tags':['top']}),
 ('B',24,'HR639','Rubor Bell Cheek','Herorange','maquillaje',2.25,2.45,None,['Sweet coral','Peach pink','Rose bloom'],{}),
 ('A',7,'HR635','Rubor líquido','Herorange','maquillaje',1.25,1.40,None,['01','02','04','05'],{}),
 ('B',25,'6526','Polvo traslúcido','Novo','maquillaje',2.75,3.10,6.00,['01','02','03'],{}),
 ('A',3,'CZ5373','Concealer coreano','Novo','maquillaje',1.85,2.00,None,['Claro','Medio'],{'promo':'Por 12 unidades te llevas 3 gratis'}),
 ('A',4,'CZ5949','Kit corrector','Novo','maquillaje',1.90,2.10,None,['01','02','03'],{'promo':'Por 12 unidades te llevas 3 gratis'}),
 ('B',26,'CZ6145','Máscara de pestañas','Novo','maquillaje',1.80,2.00,None,[],{'tags':['top']}),
 ('B',27,'6111','Crema para cejas','Novo','maquillaje',2.50,2.75,5.00,['01','02','03'],{}),
 ('B',30,'CZ160','Pestañas de anime','Velvet','maquillaje',1.00,1.10,3.00,[],{}),
 ('B',32,'ZAR029','Pestañas magnéticas','Velvet','maquillaje',1.55,1.75,4.00,[],{}),
 ('B',34,'SO-5','Pestañas Velvet 3D','Velvet','maquillaje',0.75,0.85,3.00,[],{'tags':['top']}),
 ('B',28,'ZARES1060','Pegamento Velvet Hold Tight','Velvet','maquillaje',1.30,1.45,3.00,[],{}),
 ('B',33,'ZAR030','Pinza para pestañas','Velvet','maquillaje',0.40,0.45,1.00,[],{}),
 ('B',41,'ZARES1007','Set de brochas Pretty Heart','Zares','maquillaje',2.00,2.20,4.00,[],{}),
 ('B',42,'ZAR079','Brocha para rubor','Velvet','maquillaje',3.75,4.15,7.50,[],{}),
 ('B',44,'ZAR084','Brocha de precisión para sombras','Velvet','maquillaje',1.00,1.10,2.00,[],{}),
 ('B',46,'ZAR092','Brocha angular','Velvet','maquillaje',1.65,1.85,3.00,[],{}),
 # ---------- Skincare ----------
 ('B',80,'ZARES1097','Set 3 en 1 cuidado de la piel','RubyFace','skincare',2.05,2.30,5.00,['Rosado','Lila','Azul'],{'tags':['top']}),
 ('B',79,'ZARES1126','Set Spa diadema y muñequeras','Zares','skincare',2.10,2.35,5.00,['Rosado','Celeste','Lila'],{'tags':['nuevo']}),
 ('B',97,'CZ196','Rodillo de hielo facial','Zares','skincare',2.00,2.20,None,['Surtido'],{}),
 ('B',94,'ZARES1133','Exfoliante de cuerpo','Zares','skincare',1.65,1.85,4.00,['Rosa','Crema','Menta'],{}),
 ('B',95,'ZARES1128','Silicona para hielo','Zares','skincare',0.95,1.05,2.00,[],{}),
 ('A',46,'CZ108','Tiras de cera depilatoria','Body','skincare',2.50,2.65,None,['Miel','Aloe vera'],{}),
 ('A',48,'CZ141','Depilador recargable','Flawless','skincare',7.80,8.50,None,[],{}),
 # ---------- Uñas: no hay productos en los catálogos actuales ----------
 # ---------- Capilares ----------
 ('B',73,'5892','Shampoo en seco','Novo','capilares',2.50,2.80,5.00,[],{}),
 ('B',74,'CZ144','Cera de cabello Wax Stick','Velvet','capilares',1.30,1.45,3.00,[],{'tags':['top']}),
 ('B',76,'FH909','Cepillo alisador eléctrico','Zares','capilares',4.70,5.20,10.00,[],{}),
 ('B',77,'ZAR039','Ondulador sin calor','Zares','capilares',1.50,1.65,3.00,['Vino','Rosa'],{'tags':['nuevo']}),
 ('B',78,'ZAR078','Gorro de satín','Zares','capilares',1.25,1.40,3.00,['Rosa','Vino','Negro'],{}),
 ('B',91,'CZ170','Gorro térmico','Zares','capilares',2.75,3.10,6.00,[],{}),
 ('B',75,'CZ143','Set de peinillas','Zares','capilares',1.50,1.65,3.00,[],{}),
 ('A',45,'CZ5438','Cubre canas','Novo','capilares',2.50,2.75,None,['Negro','Castaño','Castaño claro'],{'promo':'Por 12 unidades te llevas 2 gratis'}),
 ('B',81,'ZARES1134','Set de accesorios para el cabello','Zares','capilares',1.85,2.05,4.00,['Blanco','Gris','Lila','Azul','Rosado','Fucsia'],{}),
 ('A',29,'CZ122','Pinzas para cabello','Zares','capilares',0.70,0.80,1.50,['Surtido'],{}),
 ('B',85,'1139-2','Lazo de tela lunares','Zares','capilares',0.45,0.50,1.50,['Rojo','Vino'],{}),
 # ---------- Accesorios ----------
 ('B',72,'MQ-01','Cosmetiquera doble compartimiento','Zares','accesorios',14.50,15.95,24.99,[],{'tags':['top']}),
 ('B',66,'ZARES1012','Cosmetiquera lunares','Zares','accesorios',3.15,3.50,7.00,['Blanca','Negra','Rosada','Celeste'],{}),
 ('B',67,'ZARES1018','Cosmetiquera de terciopelo','Zares','accesorios',3.85,4.25,7.00,['Azul','Negro','Rosado','Gris'],{'tags':['nuevo']}),
 ('B',70,'CZ169','Cosmetiquera acolchada','Zares','accesorios',2.55,2.85,6.00,['Blanca','Amarilla','Rosada','Lila'],{}),
 ('B',62,'ZARES1005','Bolso organizador','Zares','accesorios',3.30,3.65,7.00,[],{}),
 ('A',23,'CZ136','Bolso de ballet','Zares','accesorios',4.00,4.50,None,[],{}),
 ('B',53,'ZARES1047','Mini monedero llavero','Zares','accesorios',1.80,1.95,3.50,['Surtido'],{'tags':['nuevo']}),
 ('B',56,'ZARES1039','Mini monedero peluche','Zares','accesorios',1.85,2.00,3.50,['Vaquita','Corazones'],{}),
 ('B',88,'ZARES1153','Gafas con lazos','Zares','accesorios',0.80,0.90,2.50,['Rosa','Lavanda','Celeste','Verde','Durazno','Gris'],{}),
 ('B',99,'ZARES1203','Case para iPhone con soporte','Zares','accesorios',1.60,1.76,3.00,['Verde agua','Coral'],{}),
 ('B',102,'CZ060','Espejo LED con ventilador','Zares','accesorios',6.50,7.50,None,[],{'tags':['top']}),
 ('B',103,'CZ055','Organizador de maquillaje','Zares','accesorios',4.85,5.00,None,[],{}),
 ('B',104,'ZARES1207','Set de acrílicos','Zares','accesorios',2.50,2.75,7.00,[],{}),
 ('B',98,'ZARES1022','Set viajero','Zares','accesorios',1.65,1.85,4.00,[],{}),
 ('B',105,'CZ138','Carrito multifuncional','Zares','accesorios',19.80,21.75,None,['Rosa','Negro'],{}),
]

docs = {'A': fitz.open(A), 'B': fitz.open(B)}
os.makedirs('img/products', exist_ok=True)
out = []
for src, page, pid, name, brand, cat, may, mn, pvp, tones, extra in P:
    pg = docs[src][page - 1]
    zoom = 640 / pg.rect.width
    fn = 'img/products/%s.jpg' % pid.lower()
    pg.get_pixmap(matrix=fitz.Matrix(zoom, zoom)).save(fn, jpg_quality=80)
    est = pvp is None
    if est:
        pvp = max(math.ceil(may * 2 * 4) / 4, round(mn + 0.5, 2))
    out.append({'id': pid, 'name': name, 'brand': brand, 'cat': cat, 'img': fn,
                'price': {'pvp': pvp, 'min': mn, 'may': may}, 'pvpEst': est,
                'tones': tones, 'tags': extra.get('tags', []), 'promo': extra.get('promo'),
                'source': '%s p.%d' % ('ZARESBEAUTY.pdf' if src == 'A' else 'ZARESBEAUTY-1.pdf', page)})

with open('js/data.js', 'w', encoding='utf-8') as f:
    f.write('// Generado por tools/build_catalog.py desde los catálogos Zares. No editar a mano.\n')
    f.write('window.SEED_PRODUCTS = ' + json.dumps(out, ensure_ascii=False, indent=1) + ';\n')
print(len(out), 'productos')
