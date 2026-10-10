import { realms } from '../../content/realms'
import { REALM_PROGRESS_CAP } from '../../game'
import { nextRealm } from '../../game'
import { useGameStore } from '../../state/gameStore'
import { Modal } from '../ui/Modal'

export function RealmSelectModal() {
  const player = useGameStore((s) => s.player)!
  const selectRealm = useGameStore((s) => s.selectRealm)
  const close = useGameStore((s) => s.closeRealmPicker)
  const highest = player.highestRealmId

  return (
    <Modal title="Choose realm" onClose={close}>
      <p className="text-xs text-stone-500">Travel to any realm you have already opened.</p>
      <div className="mt-3 grid gap-2">
        {realms.map((realm) => {
          const unlocked = realm.id <= highest
          const current = realm.id === player.realmId
          const frontier = realm.id === highest
          const cleared = realm.id < highest
          const pct = cleared
            ? 100
            : frontier
              ? Math.min(100, (player.realmProgress / REALM_PROGRESS_CAP) * 100)
              : 0
          return (
            <button
              key={realm.id}
              type="button"
              disabled={!unlocked}
              onClick={() => {
                if (!unlocked) return
                selectRealm(realm.id)
              }}
              className={`overflow-hidden rounded-xl border text-left ${
                current
                  ? 'border-amber-600'
                  : unlocked
                    ? 'border-stone-700'
                    : 'border-stone-800 opacity-55'
              }`}
            >
              <div className="relative h-24">
                <img src={realm.image} alt="" className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-950/40 to-transparent" />
                <div className="absolute bottom-2 left-3 right-3">
                  <p className="font-serif text-base text-amber-50">{realm.name}</p>
                  <p className="text-[11px] text-stone-300">
                    {current ? 'Current' : unlocked ? (cleared ? 'Cleared' : 'Open') : 'Locked'}
                  </p>
                </div>
              </div>
              <div className="bg-stone-950 px-3 py-2">
                <p className="text-[11px] text-stone-400">{realm.blurb}</p>
                {unlocked && (
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-stone-800">
                    <div className="h-full bg-orange-600" style={{ width: `${pct}%` }} />
                  </div>
                )}
              </div>
            </button>
          )
        })}
      </div>
      {highest > player.realmId && (
        <p className="mt-3 text-center text-xs text-amber-200">A farther realm is open. You can return here anytime.</p>
      )}
      {!nextRealm(highest) && player.realmId === highest && player.realmProgress >= REALM_PROGRESS_CAP && (
        <p className="mt-3 text-center text-xs text-amber-200">The map ends at {realms[realms.length - 1]?.name}.</p>
      )}
    </Modal>
  )
}
