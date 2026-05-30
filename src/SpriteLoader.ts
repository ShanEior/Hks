/**
 * SpriteLoader — 外部 PNG 素材加载器
 * 素材来源：东方夜雀食堂解包精灵
 */
import Phaser from 'phaser';

const PREFIX: Record<string, string> = {
  trees: 'tree', bamboo: 'bamboo', mountain: 'mtn',
  ground: 'gnd', plants: 'plant', ground_tex: 'gtex',
  atlas: 'atlas', grass_tiles: 'grass',
};

const MANIFEST: Record<string, string[]> = {
  trees: [
    'Trees01_0','Trees01_10','Trees01_11','Trees01_12','Trees01_13',
    'Trees01_14','Trees01_15','Trees01_16','Trees01_18','Trees01_19',
    'Trees01_25','Trees01_5','Trees01_6','Trees01_7',
  ],
  bamboo: [
    'Garden_Bamboo_15','Garden_Bamboo_4',
    'Trees_Bamboo_0','Trees_Bamboo_1','Trees_Bamboo_11',
    'Trees_Bamboo_2','Trees_Bamboo_3','Trees_Bamboo_7','Trees_Bamboo_8',
  ],
  mountain: [
    'Mountain01_0','Mountain01_1','Mountain01_2',
    'Moutain01_0','Moutain01_1','Moutain01_100','Moutain01_108','Moutain01_109',
    'Moutain01_11','Moutain01_117','Moutain01_119','Moutain01_12',
  ],
  ground: ['site_15','site_16','site_17','site_18','site_21','site_22'],
  plants: [
    'collection_0','collection_1','collection_2','collection_3','collection_4',
    'collection_5','collection_6','collection_7','collection_8','collection_9',
    'collection_10','collection_11','collection_12','collection_13','collection_14',
    'collection_15','collection_16','collection_17','collection_18','collection_19',
    'collection_20','collection_21','collection_22','collection_23','collection_24',
    'collection_25','collection_26','collection_27','collection_28','collection_29',
    'collection_30','collection_31','collection_32','collection_33','collection_34',
    'collection_35','collection_36','collection_37','collection_38','collection_39',
    'collection_40','collection_41','collection_42','collection_43','collection_44',
    'collection_45','collection_46','collection_47','collection_48','collection_49',
    'collection_50','collection_51','collection_52','collection_53','collection_54',
    'collection_55','collection_56','collection_57','collection_58','collection_59',
    '钓鱼水箱',
  ],
  ground_tex: [
    '2048x2048-BC7-Map_HumanVillage_Atlas_Main',
    '2048x2048-BC7-Map_HumanVillage_Atlas_Other',
    '2048x2048-BC7-Map_ScarletMansion_Atlas_Other',
    '2048x2048-BC7-Map_HakureiShrine_Atlas_Other',
    '1024x1024-BC7-Map_HumanVillage_Atlas_Other',
    '512x1024-BC7-Map_HumanVillage_Atlas_Main',
  ],
  atlas: [
    'CommonSite_Seg_256x256','CommonMountain_Seg_1024x1024',
    'CommonMountain_Seg_2048x2048','CommonMountain_Seg_2048x2048_1',
    'CommonResourcePoints_Atlas_512x512',
  ],
  grass_tiles: ['grass_large_0','grass_large_1','grass_large_2'],
};

const BASE = 'assets/sprites';

function mkey(cat: string, name: string): string {
  return `${PREFIX[cat]}_${name}`;
}

export function preloadSprites(scene: Phaser.Scene): void {
  for (const [cat, names] of Object.entries(MANIFEST)) {
    for (const name of names) {
      scene.load.image(mkey(cat, name), `${BASE}/${cat}/${name}.png`);
    }
  }
}

export function nthKey(cat: string, n: number): string {
  const names = MANIFEST[cat];
  if (!names) return '';
  return mkey(cat, names[n % names.length]);
}

export function randKey(cat: string): string {
  const names = MANIFEST[cat];
  if (!names) return '';
  return mkey(cat, names[Math.floor(Math.random() * names.length)]);
}
