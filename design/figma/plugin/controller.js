figma.showUI(__html__, { width: 460, height: 530, themeColors: true });
let importing = false;
figma.ui.onmessage = async message => {
  if (message.type === 'close') { if (!importing) figma.closePlugin(); return; }
  if (message.type !== 'import' || importing) return;
  importing = true;
  const results = [];
  try {
    const snapshots = message.snapshots.filter(item => item?.viewport && Array.isArray(item.tree));
    if (!snapshots.length) throw new Error('Choose the captured landing, waitlist, or confirmation JSON files.');
    for (let index = 0; index < snapshots.length; index += 1) {
      const snapshot = snapshots[index];
      figma.ui.postMessage({ type: 'progress', name: snapshot.name, current: index + 1, total: snapshots.length });
      results.push(await importRydeproSnapshot(snapshot, { focus: false }));
    }
    const nodes = (await Promise.all(results.map(result => figma.getNodeByIdAsync(result.id)))).filter(Boolean);
    if (nodes.length) {
      figma.currentPage.selection = nodes;
      figma.viewport.scrollAndZoomIntoView(nodes);
    }
    figma.ui.postMessage({ type: 'complete', results });
    figma.notify('RYDEPRO frames imported. Compare them with the matching reference screenshots.');
  } catch (error) {
    figma.ui.postMessage({ type: 'error', message: String(error?.message || error), results });
  } finally { importing = false; }
};
