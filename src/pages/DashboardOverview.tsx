import { useDashboardData } from '@/hooks/useDashboardData';
import { enrichBewerbungen } from '@/lib/enrich';
import type { EnrichedBewerbungen } from '@/types/enriched';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import { LivingAppsService } from '@/services/livingAppsService';
import { formatDate } from '@/lib/formatters';
import { lookupKey } from '@/lib/formatters';
import { useClock, gruss, namen, undoToast } from '@/lib/polish';
import { useState, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { DashboardGrid } from '@/components/DashboardGrid';
import { WorkList } from '@/components/WorkList';
import { HeroBanner } from '@/components/HeroBanner';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import {
  KanbanWidget,
  type KanbanCard,
  type KanbanColumn,
  type KanbanTone,
} from '@/components/widgets/KanbanWidget';
import {
  RecordOverlay,
  RecordHeader,
  RecordSection,
  RecordField,
  RecordAttachments,
  useRecordOverlayStack,
} from '@/components/widgets/RecordView';
import { BewerbungenDialog } from '@/components/dialogs/BewerbungenDialog';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import {
  IconAlertCircle,
  IconTool,
  IconRefresh,
  IconCheck,
  IconPlus,
  IconBriefcase,
  IconClipboardList,
  IconUserCheck,
  IconBan,
  IconBuilding,
} from '@tabler/icons-react';

const APPGROUP_ID = '6a463120915583748c61f684';
const REPAIR_ENDPOINT = '/claude/build/repair';

// ─── Kanban columns from the schema ─────────────────────────────────────────
const PHASE_COLUMNS: KanbanColumn[] = (
  LOOKUP_OPTIONS['bewerbungen']?.['phase'] ?? []
).map(o => ({ key: o.key, label: o.label }));

function toneForPhase(phase: string | undefined): KanbanTone {
  if (phase === 'angebot') return 'success';
  if (phase === 'gespraech_1' || phase === 'gespraech_2') return 'primary';
  if (phase === 'abgelehnt') return 'default';
  if (phase === 'screening') return 'warning';
  return 'warning'; // eingegangen → needs attention
}

export default function DashboardOverview() {
  const {
    bewerbungen, setBewerbungen, stellen,
    stellenMap,
    loading, error, fetchAll,
  } = useDashboardData();

  const clock = useClock();
  const enrichedBewerbungen = enrichBewerbungen(bewerbungen, { stellenMap });

  // ─── Overlay ────────────────────────────────────────────────────────────
  const overlay = useRecordOverlayStack<{ type: string; id: string }>();

  // ─── Dialog state ────────────────────────────────────────────────────────
  const [createOpen, setCreateOpen] = useState(false);
  const [createDefaults, setCreateDefaults] = useState<Record<string, unknown>>({});
  const [editRecord, setEditRecord] = useState<EnrichedBewerbungen | null>(null);

  // ─── Derived data ────────────────────────────────────────────────────────
  const today = useMemo(() => {
    const d = clock;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, [clock]);

  const neuHeuteList = useMemo(
    () => enrichedBewerbungen.filter(b => b.fields.eingangsdatum?.slice(0, 10) === today),
    [enrichedBewerbungen, today],
  );

  const offeneStellen = useMemo(
    () => stellen.filter(s => lookupKey(s.fields.status) === 'offen'),
    [stellen],
  );

  const imAngebot = useMemo(
    () => enrichedBewerbungen.filter(b => lookupKey(b.fields.phase) === 'angebot'),
    [enrichedBewerbungen],
  );

  const abgelehnt = useMemo(
    () => bewerbungen.filter(b => lookupKey(b.fields.phase) === 'abgelehnt'),
    [bewerbungen],
  );

  // ─── KanbanCards ─────────────────────────────────────────────────────────
  const cards = useMemo<KanbanCard[]>(
    () =>
      enrichedBewerbungen.map(b => {
        const phase = lookupKey(b.fields.phase) ?? PHASE_COLUMNS[0]?.key ?? '';
        const name = [b.fields.vorname, b.fields.nachname].filter(Boolean).join(' ') || 'Unbekannt';
        return {
          id: `bewerbung:${b.record_id}`,
          column: phase,
          title: name,
          subtitle: b.stelleName
            ? `${b.stelleName}${b.fields.eingangsdatum ? ` · ${formatDate(b.fields.eingangsdatum)}` : ''}`
            : b.fields.eingangsdatum
              ? formatDate(b.fields.eingangsdatum)
              : undefined,
          tone: toneForPhase(phase),
        };
      }),
    [enrichedBewerbungen],
  );

  // ─── Phase-advance helper (shared across board, list, overlay) ───────────
  const advancePhase = async (b: EnrichedBewerbungen) => {
    const phaseOrder = PHASE_COLUMNS.map(c => c.key);
    const cur = lookupKey(b.fields.phase) ?? phaseOrder[0];
    const idx = phaseOrder.indexOf(cur);
    if (idx < 0 || idx >= phaseOrder.length - 2) return; // already at last real stage or abgelehnt
    const next = phaseOrder[idx + 1];
    if (next === 'abgelehnt') return; // don't auto-advance to rejected
    const prev = cur;
    setBewerbungen(prev2 =>
      prev2.map(r =>
        r.record_id === b.record_id
          ? { ...r, fields: { ...r.fields, phase: { key: next, label: next } } }
          : r,
      ),
    );
    undoToast(
      `${b.fields.vorname ?? ''} ${b.fields.nachname ?? ''} → ${PHASE_COLUMNS.find(c => c.key === next)?.label ?? next}`,
      async () => {
        setBewerbungen(prev2 =>
          prev2.map(r =>
            r.record_id === b.record_id
              ? { ...r, fields: { ...r.fields, phase: { key: prev, label: prev } } }
              : r,
          ),
        );
        try {
          await LivingAppsService.updateBewerbungenEntry(b.record_id, { phase: prev });
        } catch {
          await fetchAll();
        }
      },
    );
    try {
      await LivingAppsService.updateBewerbungenEntry(b.record_id, { phase: next });
    } catch {
      await fetchAll();
    }
  };

  // ─── onCardMove ──────────────────────────────────────────────────────────
  const moveCard = async (cardId: string, newColumn: string) => {
    const rid = cardId.split(':')[1];
    if (!rid) return;
    const target = bewerbungen.find(b => b.record_id === rid);
    if (!target) return;
    const prev = lookupKey(target.fields.phase) ?? '';
    setBewerbungen(prev2 =>
      prev2.map(b =>
        b.record_id === rid
          ? { ...b, fields: { ...b.fields, phase: { key: newColumn, label: newColumn } } }
          : b,
      ),
    );
    undoToast(
      `Phase geändert → ${PHASE_COLUMNS.find(c => c.key === newColumn)?.label ?? newColumn}`,
      async () => {
        setBewerbungen(prev2 =>
          prev2.map(b =>
            b.record_id === rid
              ? { ...b, fields: { ...b.fields, phase: { key: prev, label: prev } } }
              : b,
          ),
        );
        try {
          await LivingAppsService.updateBewerbungenEntry(rid, { phase: prev });
        } catch {
          await fetchAll();
        }
      },
    );
    try {
      await LivingAppsService.updateBewerbungenEntry(rid, { phase: newColumn });
    } catch {
      await fetchAll();
    }
  };

  // ─── Context line ─────────────────────────────────────────────────────────
  const contextLine = useMemo(() => {
    if (neuHeuteList.length > 0) {
      const ns = namen(neuHeuteList.map(b => `${b.fields.vorname ?? ''} ${b.fields.nachname ?? ''}`.trim()));
      return `Heute eingegangen: ${ns}.`;
    }
    if (imAngebot.length > 0) {
      const ns = namen(imAngebot.map(b => `${b.fields.vorname ?? ''} ${b.fields.nachname ?? ''}`.trim()));
      return `${ns} ${imAngebot.length === 1 ? 'wartet' : 'warten'} auf eine Angebotsentscheidung.`;
    }
    if (bewerbungen.length === 0) {
      return 'Noch keine Bewerbungen — starte mit der ersten Ausschreibung.';
    }
    return `${bewerbungen.length} Bewerbung${bewerbungen.length !== 1 ? 'en' : ''} insgesamt im System.`;
  }, [neuHeuteList, imAngebot, bewerbungen]);

  // ─── Overlay top record ─────────────────────────────────────────────────
  const overlayRecord = overlay.top
    ? enrichedBewerbungen.find(b => b.record_id === overlay.top!.id)
    : undefined;

  const overlayPhase = overlayRecord ? lookupKey(overlayRecord.fields.phase) : undefined;
  const phaseOrder = PHASE_COLUMNS.map(c => c.key);
  const curIdx = overlayPhase ? phaseOrder.indexOf(overlayPhase) : -1;
  const nextPhase = curIdx >= 0 && curIdx < phaseOrder.length - 2 ? PHASE_COLUMNS[curIdx + 1] : null;

  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  // ─── Empty state ─────────────────────────────────────────────────────────
  if (bewerbungen.length === 0 && stellen.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <IconClipboardList size={32} className="text-primary" stroke={1.5} />
        </div>
        <h1 className="text-xl font-bold">Bewerbermanagement einrichten</h1>
        <p className="text-sm text-muted-foreground max-w-xs">
          Lege zuerst eine offene Stelle an, dann kannst du Bewerbungen erfassen und durch die Phasen begleiten.
        </p>
        <Button onClick={() => { setCreateDefaults({}); setCreateOpen(true); }}>
          <IconPlus size={16} className="mr-1" />
          Erste Bewerbung erfassen
        </Button>
        <BewerbungenDialog
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          onSubmit={async (fields) => { await LivingAppsService.createBewerbungenEntry(fields); fetchAll(); }}
          stellenList={stellen}
          enablePhotoScan={AI_PHOTO_SCAN['Bewerbungen']}
          enablePhotoLocation={AI_PHOTO_LOCATION['Bewerbungen']}
        />
      </div>
    );
  }

  return (
    <>
      {/* Page header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{gruss(clock)}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{contextLine}</p>
        </div>
        <Button onClick={() => { setCreateDefaults({}); setCreateOpen(true); }}>
          <IconPlus size={16} className="mr-1" />
          Neue Bewerbung
        </Button>
      </div>

      <DashboardGrid
        variant="wide"
        hero={
          imAngebot.length > 0 && (
            <HeroBanner
              tone="primary"
              icon={<IconUserCheck size={18} />}
              action={{
                label: 'Zur Entscheidung',
                onClick: () => {
                  if (imAngebot[0]) {
                    overlay.replace({ type: 'bewerbung', id: imAngebot[0].record_id });
                  }
                },
              }}
            >
              <b>{namen(imAngebot.map(b => `${b.fields.vorname ?? ''} ${b.fields.nachname ?? ''}`.trim()))}</b>
              {' '}{imAngebot.length === 1 ? 'hat ein Angebot erhalten' : `haben Angebote erhalten`} — Entscheidung ausstehend.
            </HeroBanner>
          )
        }
        kpis={
          <StatStrip>
            <StatStripItem
              title="Bewerber"
              value={bewerbungen.length}
              icon={<IconClipboardList size={16} />}
            />
            <StatStripItem
              title="Neu heute"
              value={neuHeuteList.length}
              icon={<IconPlus size={16} />}
              tone={neuHeuteList.length > 0 ? 'primary' : 'default'}
            />
            <StatStripItem
              title="Im Angebot"
              value={imAngebot.length}
              icon={<IconUserCheck size={16} />}
              tone={imAngebot.length > 0 ? 'success' : 'default'}
            />
            <StatStripItem
              title="Offene Stellen"
              value={offeneStellen.length}
              icon={<IconBriefcase size={16} />}
              tone={offeneStellen.length === 0 ? 'warning' : 'default'}
            />
          </StatStrip>
        }
        primary={
          <KanbanWidget
            columns={PHASE_COLUMNS}
            cards={cards}
            defaultCollapsed={['abgelehnt']}
            onCardClick={card => {
              const rid = card.id.split(':')[1];
              if (rid) overlay.replace({ type: 'bewerbung', id: rid });
            }}
            onCardMove={moveCard}
            onAddCard={column => {
              setCreateDefaults({ phase: column });
              setCreateOpen(true);
            }}
          />
        }
        aside={
          <>
            <WorkList
              title="Heute & neu eingegangen"
              icon={<IconClipboardList size={14} />}
              items={neuHeuteList.map(b => ({
                id: b.record_id,
                title: `${b.fields.vorname ?? ''} ${b.fields.nachname ?? ''}`.trim() || 'Unbekannt',
                secondLine: (
                  <>
                    <span className="text-muted-foreground">{b.stelleName || '—'}</span>
                    {b.fields.quelle?.label
                      ? <span className="text-muted-foreground"> · {b.fields.quelle.label}</span>
                      : null}
                  </>
                ),
                action: {
                  label: '→ Screening',
                  onClick: () => advancePhase(b),
                },
              }))}
              onItemClick={id => overlay.replace({ type: 'bewerbung', id })}
              empty={{
                text: 'Heute noch keine neuen Bewerbungen.',
                action: {
                  label: 'Bewerbung erfassen',
                  onClick: () => { setCreateDefaults({}); setCreateOpen(true); },
                },
              }}
            />
            <WorkList
              title="Offene Stellen"
              icon={<IconBriefcase size={14} />}
              items={offeneStellen.map(s => ({
                id: s.record_id,
                title: s.fields.bezeichnung ?? '—',
                secondLine: (
                  <>
                    {s.fields.abteilung
                      ? <span className="text-muted-foreground">{s.fields.abteilung}</span>
                      : null}
                    {s.fields.beschaeftigungsart?.label
                      ? <span className="text-muted-foreground">{s.fields.abteilung ? ' · ' : ''}{s.fields.beschaeftigungsart.label}</span>
                      : null}
                    {s.fields.standort
                      ? <span className="text-muted-foreground"> · {s.fields.standort}</span>
                      : null}
                  </>
                ),
                icon: <IconBuilding size={14} />,
              }))}
              onItemClick={() => { /* Stellen haben kein Overlay im Dashboard — via Sidebar navigieren */ }}
              empty={{
                text: `${stellen.length > 0 ? 'Alle Stellen sind besetzt oder pausiert.' : 'Noch keine Stellen angelegt.'}`,
                action: {
                  label: 'Stelle anlegen',
                  onClick: () => window.location.assign('#/stellen'),
                },
              }}
            />
          </>
        }
      />

      {/* Create / Edit dialog */}
      <BewerbungenDialog
        open={createOpen || editRecord !== null}
        onClose={() => { setCreateOpen(false); setEditRecord(null); }}
        onSubmit={async (fields) => {
          if (editRecord) {
            await LivingAppsService.updateBewerbungenEntry(editRecord.record_id, fields);
          } else {
            await LivingAppsService.createBewerbungenEntry(fields);
          }
          fetchAll();
        }}
        defaultValues={editRecord ? editRecord.fields : createDefaults as Record<string, unknown>}
        recordId={editRecord?.record_id}
        stellenList={stellen}
        enablePhotoScan={AI_PHOTO_SCAN['Bewerbungen']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Bewerbungen']}
      />

      {/* Record Overlay */}
      <RecordOverlay
        open={overlay.open}
        onClose={overlay.close}
        ariaLabel="Bewerbung"
        onEdit={
          overlayRecord
            ? () => { setEditRecord(overlayRecord); overlay.close(); }
            : undefined
        }
        footer={
          overlayRecord && nextPhase && nextPhase.key !== 'abgelehnt'
            ? (
              <Button
                size="sm"
                onClick={() => { advancePhase(overlayRecord); overlay.close(); }}
              >
                → {nextPhase.label}
              </Button>
            )
            : undefined
        }
      >
        {overlayRecord && (
          <>
            <RecordHeader
              title={`${overlayRecord.fields.vorname ?? ''} ${overlayRecord.fields.nachname ?? ''}`.trim() || 'Unbekannt'}
              subtitle={overlayRecord.stelleName || overlayRecord.fields.phase?.label}
              badges={
                overlayRecord.fields.phase?.label
                  ? <span className="inline-flex items-center rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">{overlayRecord.fields.phase.label}</span>
                  : undefined
              }
            />
            <RecordSection title="Kontakt" cols={2}>
              <RecordField label="E-Mail" value={overlayRecord.fields.email} format="email" />
              <RecordField label="Telefon" value={overlayRecord.fields.telefon} format="text" />
            </RecordSection>
            <RecordSection title="Bewerbung" cols={2}>
              <RecordField label="Stelle" value={overlayRecord.stelleName || '—'} />
              <RecordField label="Eingangsdatum" value={overlayRecord.fields.eingangsdatum} format="date" />
              <RecordField label="Phase" value={overlayRecord.fields.phase} format="pill" />
              <RecordField label="Quelle" value={overlayRecord.fields.quelle} format="pill" />
            </RecordSection>
            {overlayRecord.fields.notizen && (
              <RecordSection title="Notizen">
                <RecordField label="Notizen" value={overlayRecord.fields.notizen} format="longtext" />
              </RecordSection>
            )}
            <RecordAttachments appId={APP_IDS.BEWERBUNGEN} recordId={overlayRecord.record_id} />
          </>
        )}
      </RecordOverlay>
    </>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
      </div>
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  );
}

function DashboardError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const [repairing, setRepairing] = useState(false);
  const [repairStatus, setRepairStatus] = useState('');
  const [repairDone, setRepairDone] = useState(false);
  const [repairFailed, setRepairFailed] = useState(false);

  const handleRepair = async () => {
    setRepairing(true);
    setRepairStatus('Reparatur wird gestartet...');
    setRepairFailed(false);
    const errorContext = JSON.stringify({
      type: 'data_loading',
      message: error.message,
      stack: (error.stack ?? '').split('\n').slice(0, 10).join('\n'),
      url: window.location.href,
    });
    try {
      const resp = await fetch(REPAIR_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ appgroup_id: APPGROUP_ID, error_context: errorContext }),
      });
      if (!resp.ok || !resp.body) { setRepairing(false); setRepairFailed(true); return; }
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const raw of lines) {
          const line = raw.trim();
          if (!line.startsWith('data: ')) continue;
          const content = line.slice(6);
          if (content.startsWith('[STATUS]')) setRepairStatus(content.replace(/^\[STATUS]\s*/, ''));
          if (content.startsWith('[DONE]')) { setRepairDone(true); setRepairing(false); }
          if (content.startsWith('[ERROR]') && !content.includes('Dashboard-Links')) setRepairFailed(true);
        }
      }
    } catch { setRepairing(false); setRepairFailed(true); }
  };

  if (repairDone) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-12 h-12 rounded-2xl bg-green-500/10 flex items-center justify-center">
          <IconCheck size={22} className="text-green-500" />
        </div>
        <div className="text-center">
          <h3 className="font-semibold text-foreground mb-1">Dashboard repariert</h3>
          <p className="text-sm text-muted-foreground max-w-xs">Das Problem wurde behoben. Bitte laden Sie die Seite neu.</p>
        </div>
        <Button size="sm" onClick={() => window.location.reload()}>
          <IconRefresh size={14} className="mr-1" />Neu laden
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center">
        <IconAlertCircle size={22} className="text-destructive" />
      </div>
      <div className="text-center">
        <h3 className="font-semibold text-foreground mb-1">Fehler beim Laden</h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          {repairing ? repairStatus : error.message}
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onRetry} disabled={repairing}>Erneut versuchen</Button>
        <Button size="sm" onClick={handleRepair} disabled={repairing}>
          {repairing
            ? <span className="inline-block w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-1" />
            : <IconTool size={14} className="mr-1" />}
          {repairing ? 'Reparatur läuft...' : 'Dashboard reparieren'}
        </Button>
      </div>
      {repairFailed && <p className="text-sm text-destructive">Automatische Reparatur fehlgeschlagen. Bitte kontaktieren Sie den Support.</p>}
    </div>
  );
}
