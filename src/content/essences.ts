export type EssenceDef = {
  id: string
  name: string
  monster: string
  realmId: number
}

export const ESSENCE_DEFS: EssenceDef[] = [
  { id: 'dust-mite', name: 'Dust Mote', monster: 'Dust Mite', realmId: 1 },
  { id: 'road-gnoll', name: 'Gnoll Fang', monster: 'Road Gnoll', realmId: 1 },
  { id: 'lost-shade', name: 'Shade Ichor', monster: 'Lost Shade', realmId: 1 },
  { id: 'waystone-brute', name: 'Brute Core', monster: 'Waystone Brute', realmId: 1 },
  { id: 'bone-crawler', name: 'Crawler Bone', monster: 'Bone Crawler', realmId: 2 },
  { id: 'drowned-acolyte', name: 'Drowned Salt', monster: 'Drowned Acolyte', realmId: 2 },
  { id: 'crypt-guard', name: 'Crypt Seal', monster: 'Crypt Guard', realmId: 2 },
  { id: 'vault-wraith', name: 'Wraith Ash', monster: 'Vault Wraith', realmId: 2 },
  { id: 'cinder-wolf', name: 'Cinder Ash', monster: 'Cinder Wolf', realmId: 3 },
  { id: 'magma-scarab', name: 'Scarab Carapace', monster: 'Magma Scarab', realmId: 3 },
  { id: 'peak-raider', name: 'Raider Iron', monster: 'Peak Raider', realmId: 3 },
  { id: 'ember-tyrant', name: 'Tyrant Ember', monster: 'Ember Tyrant', realmId: 3 },
]

const byId = new Map(ESSENCE_DEFS.map((entry) => [entry.id, entry]))

export function essenceDef(id: string): EssenceDef | undefined {
  return byId.get(id)
}

export function essenceName(id: string): string {
  return byId.get(id)?.name ?? 'Essence'
}

export function essencesInRealm(realmId: number): EssenceDef[] {
  return ESSENCE_DEFS.filter((entry) => entry.realmId === realmId)
}
