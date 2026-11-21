import { useState, useMemo } from 'react';
import {
  Upload, X, Download, Plus, Trash2, ArrowUp, ArrowDown,
  FileArchive, Play, AlertTriangle, FileSpreadsheet, Filter,
  Eye, RefreshCw
} from 'lucide-react';
import { toast } from './store.js';
import * as S from './excelService.js';

const download = (bytes, name, type = 'application/octet-stream') => {
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
};

const fileSize = n =>
  n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : (n / 1024).toFixed(1) + ' KB';

const uid = () => Date.now() + Math.random();

export default function ExcelFilterSplit() {
  const [files, setFiles] = useState([]);
  const [selected, setSelected] = useState([]);
  const [drag, setDrag] = useState(false);
  const [preview, setPreview] = useState('');
  const [conditions, setConditions] = useState([]);
  const [joiner, setJoiner] = useState('AND');
  const [splitCols, setSplitCols] = useState([]);
  const [mode, setMode] = useState('combined');
  const [prefix, setPrefix] = useState('');
  const [suffix, setSuffix] = useState('');
  const [formulas, setFormulas] = useState(false);
  const [plan, setPlan] = useState(null);
  const [progress, setProgress] = useState(null);
  const [busy, setBusy] = useState(false);
  const [valueSearch, setValueSearch] = useState({});

  const chosen = useMemo(
    () => files.flatMap(f =>
      f.sheets
        .filter(sh => selected.includes(f.id + '|' + sh.name))
        .map(sh => ({
          file: f.name,
          sh,
          key: f.id + '|' + sh.name
        }))
    ),
    [files, selected]
  );

  const columns = useMemo(
    () => [...new Set(chosen.flatMap(x => x.sh.cols))],
    [chosen]
  );

  const currentPreview =
    chosen.find(x => x.key === preview) || chosen[0];

  const previewRows = useMemo(
    () => currentPreview
      ? S.applyFilters(currentPreview.sh, conditions, joiner).slice(0, 50)
      : [],
    [currentPreview, conditions, joiner]
  );

  const filteredCounts = useMemo(
    () => chosen.map(x => ({
      key: x.key,
      count: S.applyFilters(x.sh, conditions, joiner).length
    })),
    [chosen, conditions, joiner]
  );

  const totalRows = chosen.reduce(
    (sum, x) => sum + x.sh.rows.length,
    0
  );

  const filteredRows = filteredCounts.reduce(
    (sum, x) => sum + x.count,
    0
  );

  const updateCondition = (id, changes) => {
    setConditions(old =>
      old.map(c => c.id === id ? { ...c, ...changes } : c)
    );
    setPlan(null);
  };

  const loadFiles = async list => {
    const current = [...files];
    const added = [];

    for (const file of list) {
      try {
        if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
          throw new Error(file.name + ': only XLSX, XLS and CSV files are supported');
        }

        if (file.size > 50 * 1024 * 1024) {
          throw new Error(file.name + ': file exceeds the 50 MB limit');
        }

        if (current.some(f => f.name === file.name && f.size === file.size)) {
          throw new Error(file.name + ': this file is already loaded');
        }

        setProgress({ label: 'Reading ' + file.name, pct: null });

        const sheets = S.readWorkbook(
          await file.arrayBuffer(),
          file.name
        );

        if (!sheets.length) {
          throw new Error(file.name + ': no worksheets found');
        }

        const item = {
          id: uid(),
          name: file.name,
          size: file.size,
          sheets
        };

        current.push(item);

        added.push(
          ...sheets.map(sh => item.id + '|' + sh.name)
        );

        toast(file.name + ': ' + sheets.length + ' worksheet(s) loaded');
      } catch (error) {
        toast(error.message, 'err');
      }
    }

    setFiles(current);
    setSelected(old => [...old, ...added]);
    setPlan(null);
    setProgress(null);
  };

  const removeFile = id => {
    setFiles(old => old.filter(f => f.id !== id));
    setSelected(old => old.filter(k => !k.startsWith(id + '|')));
    setPlan(null);
  };

  const addCondition = () => {
    if (!columns.length) return;

    setConditions(old => [
      ...old,
      {
        id: uid(),
        on: true,
        col: columns[0],
        op: 'equals',
        vals: [],
        v1: '',
        v2: ''
      }
    ]);

    setPlan(null);
  };

  const moveCondition = (index, direction) => {
    setConditions(old => {
      const next = [...old];
      const target = index + direction;

      if (target < 0 || target >= next.length) return old;

      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

    setPlan(null);
  };

  const runSplit = async () => {
    if (!chosen.length) {
      return toast('Select at least one worksheet', 'err');
    }

    setBusy(true);
    setPlan(null);

    try {
      const result = await S.buildPlan(
        {
          sheets: chosen,
          conds: conditions,
          joiner,
          splitCols,
          mode,
          prefix,
          suffix
        },
        pct => setProgress({
          label: 'Analysing worksheet rows',
          pct: Math.round(pct * 100)
        })
      );

      setPlan({
        ...result,
        formulas,
        description: S.describe(conditions, joiner),
        createdAt: new Date().toLocaleString()
      });

      if (result.outputs.length) {
        toast(result.outputs.length + ' output file(s) generated');
      } else {
        toast('No output files. Check your filters and selected worksheets.', 'err');
      }
    } catch (error) {
      toast(error.message, 'err');
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const downloadOne = output => {
    try {
      download(S.makeBytes(output, plan.formulas), output.name);
      toast(output.name + ' downloaded');
    } catch (error) {
      toast(error.message, 'err');
    }
  };

  const downloadZip = async () => {
    if (!plan?.outputs?.length) return;

    setBusy(true);

    try {
      const bytes = await S.makeZip(
        plan.outputs,
        plan.formulas,
        pct => setProgress({
          label: 'Building ZIP archive',
          pct: Math.round(pct * 100)
        })
      );

      download(
        bytes,
        'excel-split-' + new Date().toISOString().slice(0, 10) + '.zip',
        'application/zip'
      );

      toast('ZIP archive downloaded');
    } catch (error) {
      toast(error.message, 'err');
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const downloadFilteredWorkbook = () => {
    try {
      const bytes = S.filteredBytes(
        chosen,
        conditions,
        joiner,
        formulas
      );

      download(bytes, 'filtered-workbook.xlsx');
      toast('Filtered workbook downloaded');
    } catch (error) {
      toast(error.message, 'err');
    }
  };

  const downloadCsv = () => {
    if (!currentPreview) return;

    try {
      const csv = S.filteredCsv(
        currentPreview.sh,
        conditions,
        joiner
      );

      download(
        '\uFEFF' + csv,
        S.cleanName(S.baseName(currentPreview.file) + '-' +
          currentPreview.sh.name + '-filtered') + '.csv',
        'text/csv;charset=utf-8'
      );

      toast('Filtered CSV downloaded');
    } catch (error) {
      toast(error.message, 'err');
    }
  };

  const toggleSplitColumn = col => {
    setSplitCols(old =>
      old.includes(col)
        ? old.filter(x => x !== col)
        : [...old, col]
    );
    setPlan(null);
  };

  const styles = {
    section: { marginBottom: 18 },
    heading: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      flexWrap: 'wrap',
      marginBottom: 14
    },
    muted: { color: 'var(--muted, #8490a5)', fontSize: 12 },
    field: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      minWidth: 130
    },
    actions: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      flexWrap: 'wrap'
    },
    stat: {
      padding: 14,
      border: '1px solid var(--border, #e5e7eb)',
      borderRadius: 10,
      minWidth: 110,
      flex: '1 1 110px'
    },
    scroll: { overflowX: 'auto', width: '100%' }
  };

  return (
    <>
      {progress && (
        <div className="card" style={styles.section}>
          <div className="row">
            <RefreshCw size={15} />
            <b>{progress.label}</b>
            <span className="grow" />
            <small>{progress.pct == null ? 'Please wait...' : progress.pct + '%'}</small>
          </div>
          <div className="bar">
            <i style={{ width: (progress.pct ?? 35) + '%' }} />
          </div>
        </div>
      )}

      <div className="card" style={styles.section}>
        <div style={styles.heading}>
          <div>
            <h3>1. Upload Excel Workbooks</h3>
            <small style={styles.muted}>
              Upload multiple XLSX, XLS or CSV files. Maximum 50 MB per file.
            </small>
          </div>
          <FileSpreadsheet size={23} />
        </div>

        <div
          className={'drop' + (drag ? ' on' : '')}
          onDragOver={e => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={e => {
            e.preventDefault();
            setDrag(false);
            loadFiles([...e.dataTransfer.files]);
          }}
        >
          <Upload size={28} />
          <p><b>Drag and drop your files here</b></p>
          <p style={styles.muted}>or select files from your computer</p>
          <input
            type="file"
            multiple
            accept=".xlsx,.xls,.csv"
            onChange={e => {
              loadFiles([...e.target.files]);
              e.target.value = '';
            }}
          />
          <small style={styles.muted}>
            All processing happens in your browser. Original files are not modified.
          </small>
        </div>

        {!files.length && (
          <p className="empty">No workbooks uploaded yet.</p>
        )}

        {files.map(file => (
          <div className="job" key={file.id}>
            <div className="row">
              <FileSpreadsheet size={18} />
              <b>{file.name}</b>
              <small style={styles.muted}>
                {fileSize(file.size)} · {file.sheets.length} worksheet(s)
              </small>
              <span className="grow" />
              <button
                className="ic"
                title="Remove workbook"
                onClick={() => removeFile(file.id)}
              >
                <X size={16} />
              </button>
            </div>

            <div style={styles.scroll}>
              <table>
                <thead>
                  <tr>
                    <th>Select</th>
                    <th>Worksheet</th>
                    <th>Rows</th>
                    <th>Columns</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {file.sheets.map(sh => {
                    const key = file.id + '|' + sh.name;
                    const count = filteredCounts.find(x => x.key === key);

                    return (
                      <tr key={key}>
                        <td>
                          <input
                            type="checkbox"
                            checked={selected.includes(key)}
                            onChange={e => {
                              setSelected(old =>
                                e.target.checked
                                  ? [...old, key]
                                  : old.filter(x => x !== key)
                              );
                              setPlan(null);
                            }}
                          />
                        </td>
                        <td>{sh.name}</td>
                        <td>{sh.rows.length.toLocaleString()}</td>
                        <td>{sh.cols.length}</td>
                        <td>
                          <button
                            className="btn ghost"
                            onClick={() => {
                              setPreview(key);
                              if (!selected.includes(key)) {
                                setSelected(old => [...old, key]);
                              }
                            }}
                          >
                            <Eye size={14} /> Preview
                          </button>
                          {count && (
                            <small style={{ marginLeft: 8 }}>
                              {count.count.toLocaleString()} filtered
                            </small>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        {totalRows > 100000 && (
          <p className="er">
            <AlertTriangle size={15} />
            Large workbook selection: {totalRows.toLocaleString()} rows.
            Processing may take additional time.
          </p>
        )}
      </div>

      {chosen.length > 0 && (
        <>
          <div className="card" style={styles.section}>
            <div style={styles.heading}>
              <div>
                <h3>2. Filter Your Data</h3>
                <small style={styles.muted}>
                  Create conditions to select the rows you need.
                </small>
              </div>
              <Filter size={22} />
            </div>

            <div className="row" style={{ flexWrap: 'wrap' }}>
              <label style={styles.field}>
                Combine conditions
                <select
                  value={joiner}
                  onChange={e => {
                    setJoiner(e.target.value);
                    setPlan(null);
                  }}
                >
                  <option value="AND">AND — all conditions</option>
                  <option value="OR">OR — any condition</option>
                </select>
              </label>

              <span className="grow" />

              <button className="btn" onClick={addCondition}>
                <Plus size={15} /> Add condition
              </button>
            </div>

            {!conditions.length && (
              <p className="empty">
                No filters added. All rows will be included.
              </p>
            )}

            {conditions.map((condition, index) => {
              const values = S.uniqueValues(chosen, condition.col);
              const search = valueSearch[condition.id] || '';
              const visibleValues = values.filter(item =>
                item.v.toLowerCase().includes(search.toLowerCase())
              ).slice(0, 300);

              const usesValues =
                condition.op === 'equals' ||
                condition.op === 'not equals';

              const noValue = [
                'empty',
                'not empty'
              ].includes(condition.op);

              return (
                <div className="cond" key={condition.id}>
                  <div className="row" style={{ flexWrap: 'wrap' }}>
                    <input
                      type="checkbox"
                      title="Enable or disable condition"
                      checked={condition.on !== false}
                      onChange={e => updateCondition(condition.id, {
                        on: e.target.checked
                      })}
                    />

                    <select
                      value={condition.col}
                      onChange={e => updateCondition(condition.id, {
                        col: e.target.value,
                        vals: [],
                        v1: '',
                        v2: ''
                      })}
                    >
                      {columns.map(col => (
                        <option key={col} value={col}>{col}</option>
                      ))}
                    </select>

                    <select
                      value={condition.op}
                      onChange={e => updateCondition(condition.id, {
                        op: e.target.value,
                        vals: [],
                        v1: '',
                        v2: ''
                      })}
                    >
                      {S.OPS.map(op => (
                        <option key={op} value={op}>{op}</option>
                      ))}
                    </select>

                    {!noValue && !usesValues && (
                      <input
                        placeholder={condition.op === 'between' ? 'From' : 'Value'}
                        value={condition.v1}
                        onChange={e => updateCondition(condition.id, {
                          v1: e.target.value
                        })}
                      />
                    )}

                    {condition.op === 'between' && (
                      <input
                        placeholder="To"
                        value={condition.v2}
                        onChange={e => updateCondition(condition.id, {
                          v2: e.target.value
                        })}
                      />
                    )}

                    {usesValues && (
                      <button
                        className="btn ghost"
                        onClick={() => updateCondition(condition.id, {
                          showValues: !condition.showValues
                        })}
                      >
                        Values ({condition.vals.length})
                      </button>
                    )}

                    <span className="grow" />

                    <button
                      className="ic"
                      title="Move up"
                      disabled={index === 0}
                      onClick={() => moveCondition(index, -1)}
                    >
                      <ArrowUp size={15} />
                    </button>

                    <button
                      className="ic"
                      title="Move down"
                      disabled={index === conditions.length - 1}
                      onClick={() => moveCondition(index, 1)}
                    >
                      <ArrowDown size={15} />
                    </button>

                    <button
                      className="ic"
                      title="Delete condition"
                      onClick={() => {
                        setConditions(old =>
                          old.filter(x => x.id !== condition.id)
                        );
                        setPlan(null);
                      }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>

                  {usesValues && condition.showValues && (
                    <div className="pop">
                      <input
                        placeholder="Search unique values..."
                        value={search}
                        onChange={e => setValueSearch(old => ({
                          ...old,
                          [condition.id]: e.target.value
                        }))}
                      />

                      <div className="row" style={{ margin: '8px 0' }}>
                        <button
                          className="btn ghost"
                          onClick={() => updateCondition(condition.id, {
                            vals: []
                          })}
                        >
                          Clear selection
                        </button>
                        <button
                          className="btn ghost"
                          onClick={() => updateCondition(condition.id, {
                            vals: values.map(x => x.v)
                          })}
                        >
                          Select all
                        </button>
                        <small style={styles.muted}>
                          Case-insensitive unique values
                        </small>
                      </div>

                      <div style={{
                        maxHeight: 190,
                        overflowY: 'auto',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))',
                        gap: 7
                      }}>
                        {visibleValues.map(item => (
                          <label className="chk" key={item.v.toLowerCase()}>
                            <input
                              type="checkbox"
                              checked={condition.vals.some(
                                v => v.toLowerCase() === item.v.toLowerCase()
                              )}
                              onChange={e => {
                                const next = e.target.checked
                                  ? [...condition.vals, item.v]
                                  : condition.vals.filter(
                                    v => v.toLowerCase() !== item.v.toLowerCase()
                                  );

                                updateCondition(condition.id, { vals: next });
                              }}
                            />
                            <span>{item.v || '(Blank)'}</span>
                            <small>{item.count}</small>
                          </label>
                        ))}
                      </div>

                      {values.length > 300 && (
                        <small style={styles.muted}>
                          Showing the first 300 matching values. Search to find others.
                        </small>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            <div className="row" style={{
              flexWrap: 'wrap',
              marginTop: 14,
              justifyContent: 'space-between'
            }}>
              <b>
                Matching rows: {filteredRows.toLocaleString()} / {totalRows.toLocaleString()}
              </b>

              <div style={styles.actions}>
                <button
                  className="btn ghost"
                  onClick={downloadFilteredWorkbook}
                >
                  <Download size={14} /> Filtered XLSX
                </button>

                <button
                  className="btn ghost"
                  onClick={downloadCsv}
                  disabled={!currentPreview}
                >
                  <Download size={14} /> Current Sheet CSV
                </button>
              </div>
            </div>
          </div>

          <div className="card" style={styles.section}>
            <div style={styles.heading}>
              <div>
                <h3>3. Configure Split</h3>
                <small style={styles.muted}>
                  Choose which columns determine the output files.
                </small>
              </div>
              <FileArchive size={22} />
            </div>

            <b>Split by columns</b>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))',
              gap: 9,
              marginTop: 12
            }}>
              {columns.map(col => (
                <label className="chk" key={col}>
                  <input
                    type="checkbox"
                    checked={splitCols.includes(col)}
                    onChange={() => toggleSplitColumn(col)}
                  />
                  <span>{col}</span>
                </label>
              ))}
            </div>

            {!splitCols.length && (
              <p className="warnbox">
                No split column selected. The system will create one output
                workbook per selected worksheet.
              </p>
            )}

            {splitCols.length > 0 && (
              <>
                <div style={{ marginTop: 16 }}>
                  <b>Output organization</b>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))',
                    gap: 12,
                    marginTop: 10
                  }}>
                    <label className="chk">
                      <input
                        type="radio"
                        name="split-mode"
                        checked={mode === 'combined'}
                        onChange={() => {
                          setMode('combined');
                          setPlan(null);
                        }}
                      />
                      <span>
                        <b>Combined output</b>
                        <small>One file per split value, with worksheets combined inside.</small>
                      </span>
                    </label>

                    <label className="chk">
                      <input
                        type="radio"
                        name="split-mode"
                        checked={mode === 'perSheet'}
                        onChange={() => {
                          setMode('perSheet');
                          setPlan(null);
                        }}
                      />
                      <span>
                        <b>Separate worksheet files</b>
                        <small>One file for each split value and source worksheet.</small>
                      </span>
                    </label>
                  </div>
                </div>
              </>
            )}

            <div className="row" style={{
              flexWrap: 'wrap',
              marginTop: 16
            }}>
              <label style={styles.field}>
                Filename prefix
                <input
                  value={prefix}
                  placeholder="Example: Export_"
                  onChange={e => {
                    setPrefix(e.target.value);
                    setPlan(null);
                  }}
                />
              </label>

              <label style={styles.field}>
                Filename suffix
                <input
                  value={suffix}
                  placeholder="Example: _2026"
                  onChange={e => {
                    setSuffix(e.target.value);
                    setPlan(null);
                  }}
                />
              </label>
            </div>

            <label className="chk" style={{ marginTop: 14 }}>
              <input
                type="checkbox"
                checked={formulas}
                onChange={e => {
                  setFormulas(e.target.checked);
                  setPlan(null);
                }}
              />
              <span>
                Preserve compatible formulas
                <small>
                  Disabled by default: exports calculated cell values.
                  Some formulas cannot be safely shifted between worksheets.
                </small>
              </span>
            </label>

            <div className="row" style={{ marginTop: 18 }}>
              <span className="grow" />
              <button
                className="btn"
                disabled={busy || !chosen.length}
                onClick={runSplit}
              >
                <Play size={15} />
                {busy ? 'Processing...' : 'Generate Split Files'}
              </button>
            </div>
          </div>

          {currentPreview && (
            <div className="card" style={styles.section}>
              <div style={styles.heading}>
                <div>
                  <h3>4. Data Preview</h3>
                  <small style={styles.muted}>
                    {currentPreview.file} · {currentPreview.sh.name}
                  </small>
                </div>
                <Eye size={21} />
              </div>

              <div className="row" style={{ flexWrap: 'wrap' }}>
                <label style={styles.field}>
                  Preview worksheet
                  <select
                    value={currentPreview.key}
                    onChange={e => setPreview(e.target.value)}
                  >
                    {chosen.map(x => (
                      <option key={x.key} value={x.key}>
                        {x.file} — {x.sh.name}
                      </option>
                    ))}
                  </select>
                </label>
                <span className="grow" />
                <small style={styles.muted}>
                  Showing {previewRows.length} of {filteredCounts.find(
                    x => x.key === currentPreview.key
                  )?.count.toLocaleString() || 0} matching rows
                </small>
              </div>

              <div style={styles.scroll}>
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      {currentPreview.sh.cols.map(col => (
                        <th key={col}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, index) => (
                      <tr key={row.r}>
                        <td>{index + 1}</td>
                        {currentPreview.sh.cols.map((col, i) => (
                          <td key={col}>
                            {row.vals[i] instanceof Date
                              ? S.norm(row.vals[i])
                              : row.vals[i] == null
                                ? ''
                                : String(row.vals[i])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {!previewRows.length && (
                <p className="empty">No rows match the current filters.</p>
              )}
            </div>
          )}
        </>
      )}

      {plan && (
        <div className="card" style={styles.section}>
          <div style={styles.heading}>
            <div>
              <h3>5. Generated Output Files</h3>
              <small style={styles.muted}>
                Generated {plan.createdAt}
              </small>
            </div>
            <FileArchive size={23} />
          </div>

          <div className="row" style={{
            flexWrap: 'wrap',
            gap: 10,
            marginBottom: 16
          }}>
            <div style={styles.stat}>
              <small style={styles.muted}>Output files</small>
              <h2>{plan.outputs.length}</h2>
            </div>
            <div style={styles.stat}>
              <small style={styles.muted}>Exported rows</small>
              <h2>{plan.totalRows.toLocaleString()}</h2>
            </div>
            <div style={styles.stat}>
              <small style={styles.muted}>Skipped worksheets</small>
              <h2>{plan.skipped.length}</h2>
            </div>
          </div>

          <div className="row" style={{
            justifyContent: 'space-between',
            flexWrap: 'wrap'
          }}>
            <div>
              <b>Filter conditions</b>
              <p style={styles.muted}>{plan.description}</p>
            </div>

            <button
              className="btn"
              disabled={!plan.outputs.length || busy}
              onClick={downloadZip}
            >
              <FileArchive size={15} /> Download All ZIP
            </button>
          </div>

          {!plan.outputs.length && (
            <p className="empty">
              No files were generated. Review your filters and split columns.
            </p>
          )}

          {plan.outputs.map(output => (
            <div className="job" key={output.name}>
              <div className="row" style={{ flexWrap: 'wrap' }}>
                <FileSpreadsheet size={18} />
                <div>
                  <b>{output.name}</b>
                  <small style={styles.muted}>
                    {output.rows.toLocaleString()} rows · {output.parts.length} worksheet(s)
                  </small>
                </div>
                <span className="grow" />
                <button
                  className="btn ghost"
                  onClick={() => downloadOne(output)}
                >
                  <Download size={14} /> Download
                </button>
              </div>

              <div style={styles.scroll}>
                <table>
                  <thead>
                    <tr>
                      <th>Output worksheet</th>
                      <th>Source</th>
                      <th>Rows</th>
                    </tr>
                  </thead>
                  <tbody>
                    {output.sheets.map((sheet, index) => (
                      <tr key={sheet.name + index}>
                        <td>{sheet.name}</td>
                        <td>{sheet.source}</td>
                        <td>{sheet.rows.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {plan.skipped.length > 0 && (
            <div className="warnbox">
              <b><AlertTriangle size={15} /> Skipped worksheets</b>
              {plan.skipped.map((item, index) => (
                <p key={index}>
                  <b>{item.file} — {item.sheet}:</b> {item.reason}
                </p>
              ))}
            </div>
          )}

          <div className="row" style={{ marginTop: 14 }}>
            <button
              className="btn ghost"
              onClick={() => setPlan(null)}
            >
              <RefreshCw size={14} /> Clear generated plan
            </button>
          </div>
        </div>
      )}
    </>
  );
}
