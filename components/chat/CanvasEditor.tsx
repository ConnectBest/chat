"use client";
import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface CanvasDocument {
  id: string;
  title: string;
  content: string;
  lastEdited: string;
  editors: string[];
}

interface CanvasEditorProps {
  channelId: string;
  onClose: () => void;
}

export function CanvasEditor({ channelId, onClose }: CanvasEditorProps) {
  const [documents, setDocuments] = useState<CanvasDocument[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<CanvasDocument | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [showNewDocForm, setShowNewDocForm] = useState(false);
  const [newDocTitle, setNewDocTitle] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load documents for channel
  useEffect(() => {
    // Static code Backend team please change it to dynamic - GET /api/canvas/:channelId
    const mockDocs: CanvasDocument[] = [
      {
        id: '1',
        title: 'Team Meeting Notes',
        content: '# Weekly Team Sync\n\n## Agenda\n- Project updates\n- Sprint planning\n- Q&A\n\n## Action Items\n- [ ] Review pull requests\n- [ ] Update documentation\n- [ ] Schedule next meeting',
        lastEdited: new Date().toISOString(),
        editors: ['User 1', 'User 2']
      },
      {
        id: '2',
        title: 'Project Roadmap',
        content: '# Q4 Roadmap\n\n## Phase 1\n- Feature A\n- Feature B\n\n## Phase 2\n- Feature C\n- Feature D',
        lastEdited: new Date(Date.now() - 86400000).toISOString(),
        editors: ['User 1']
      }
    ];
    setDocuments(mockDocs);
  }, [channelId]);

  function createNewDocument() {
    if (!newDocTitle.trim()) return;

    const newDoc: CanvasDocument = {
      id: Date.now().toString(),
      title: newDocTitle.trim(),
      content: '',
      lastEdited: new Date().toISOString(),
      editors: ['You']
    };

    setDocuments(prev => [newDoc, ...prev]);
    setSelectedDoc(newDoc);
    setTitle(newDoc.title);
    setContent(newDoc.content);
    setIsEditing(true);
    setShowNewDocForm(false);
    setNewDocTitle('');
    // Static code Backend team please change it to dynamic - POST /api/canvas
  }

  function openDocument(doc: CanvasDocument) {
    setSelectedDoc(doc);
    setTitle(doc.title);
    setContent(doc.content);
    setIsEditing(false);
  }

  function saveDocument() {
    if (!selectedDoc) return;

    const updatedDoc = {
      ...selectedDoc,
      title,
      content,
      lastEdited: new Date().toISOString()
    };

    setDocuments(prev => prev.map(d => d.id === selectedDoc.id ? updatedDoc : d));
    setSelectedDoc(updatedDoc);
    setIsEditing(false);
    // Static code Backend team please change it to dynamic - PUT /api/canvas/:id
  }

  function deleteDocument() {
    if (!selectedDoc || !confirm('Delete this document?')) return;

    setDocuments(prev => prev.filter(d => d.id !== selectedDoc.id));
    setSelectedDoc(null);
    setTitle('');
    setContent('');
    // Static code Backend team please change it to dynamic - DELETE /api/canvas/:id
  }

  function insertFormatting(type: 'heading' | 'bold' | 'italic' | 'code' | 'list' | 'checkbox') {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end) || 'text';
    let newText = '';
    let cursorOffset = 0;

    switch (type) {
      case 'heading':
        newText = `# ${selectedText}`;
        cursorOffset = 2;
        break;
      case 'bold':
        newText = `**${selectedText}**`;
        cursorOffset = 2;
        break;
      case 'italic':
        newText = `*${selectedText}*`;
        cursorOffset = 1;
        break;
      case 'code':
        newText = `\`${selectedText}\``;
        cursorOffset = 1;
        break;
      case 'list':
        newText = `- ${selectedText}`;
        cursorOffset = 2;
        break;
      case 'checkbox':
        newText = `- [ ] ${selectedText}`;
        cursorOffset = 6;
        break;
    }

    const newContent = content.substring(0, start) + newText + content.substring(end);
    setContent(newContent);

    // Restore cursor position
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + cursorOffset, start + cursorOffset + selectedText.length);
    }, 0);
  }

  function renderMarkdown(text: string) {
    let html = text
      .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mb-2 text-white">$1</h1>')
      .replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold mb-2 text-white">$1</h2>')
      .replace(/^### (.*$)/gim, '<h3 class="text-lg font-bold mb-2 text-white">$1</h3>')
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em class="italic">$1</em>')
      .replace(/`(.*?)`/g, '<code class="bg-white/10 px-1 rounded text-brand-300">$1</code>')
      .replace(/^- \[ \] (.*$)/gim, '<div class="flex items-center gap-2"><input type="checkbox" class="rounded" /> <span>$1</span></div>')
      .replace(/^- \[x\] (.*$)/gim, '<div class="flex items-center gap-2"><input type="checkbox" checked class="rounded" /> <span class="line-through text-white/50">$1</span></div>')
      .replace(/^- (.*$)/gim, '<li class="ml-4">• $1</li>')
      .replace(/\n/g, '<br />');

    return html;
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div 
        className="w-full max-w-6xl h-[90vh] flex rounded-lg shadow-2xl overflow-hidden"
        style={{ background: 'linear-gradient(to bottom, #3d4b6d, #2f3a52)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Sidebar - Document List */}
        <div className="w-64 border-r border-white/10 flex flex-col">
          <div className="p-4 border-b border-white/10">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-semibold flex items-center gap-2">
                📄 Canvas
              </h3>
              <button
                onClick={onClose}
                className="text-white/70 hover:text-white transition"
                title="Close"
              >
                ✕
              </button>
            </div>
            <Button
              onClick={() => setShowNewDocForm(true)}
              className="w-full text-sm"
            >
              + New Document
            </Button>
          </div>

          {/* New Document Form */}
          {showNewDocForm && (
            <div className="p-3 border-b border-white/10 bg-white/5">
              <Input
                value={newDocTitle}
                onChange={e => setNewDocTitle(e.target.value)}
                placeholder="Document title..."
                autoFocus
                className="mb-2"
              />
              <div className="flex gap-2">
                <Button onClick={createNewDocument} className="flex-1 text-xs">Create</Button>
                <Button onClick={() => { setShowNewDocForm(false); setNewDocTitle(''); }} variant="secondary" className="flex-1 text-xs">Cancel</Button>
              </div>
            </div>
          )}

          {/* Document List */}
          <div className="flex-1 overflow-y-auto">
            {documents.map(doc => (
              <button
                key={doc.id}
                onClick={() => openDocument(doc)}
                className={`w-full p-3 text-left border-b border-white/10 hover:bg-white/5 transition ${
                  selectedDoc?.id === doc.id ? 'bg-white/10' : ''
                }`}
              >
                <div className="text-white font-medium text-sm truncate mb-1">
                  {doc.title}
                </div>
                <div className="text-white/50 text-xs">
                  {new Date(doc.lastEdited).toLocaleDateString()}
                </div>
                <div className="text-white/40 text-xs mt-1">
                  {doc.editors.join(', ')}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Editor Area */}
        <div className="flex-1 flex flex-col">
          {selectedDoc ? (
            <>
              {/* Toolbar */}
              <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <Input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  disabled={!isEditing}
                  className="text-xl font-bold flex-1 mr-4"
                />
                <div className="flex gap-2">
                  {isEditing ? (
                    <>
                      <Button onClick={saveDocument}>Save</Button>
                      <Button onClick={() => { setIsEditing(false); setTitle(selectedDoc.title); setContent(selectedDoc.content); }} variant="secondary">Cancel</Button>
                    </>
                  ) : (
                    <>
                      <Button onClick={() => setIsEditing(true)}>Edit</Button>
                      <button
                        onClick={deleteDocument}
                        className="px-3 py-2 text-red-400 hover:bg-red-500/20 rounded transition text-sm"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Formatting Toolbar (when editing) */}
              {isEditing && (
                <div className="px-4 py-2 border-b border-white/10 flex gap-2">
                  <button onClick={() => insertFormatting('heading')} className="px-2 py-1 bg-white/5 hover:bg-white/10 rounded text-white text-sm" title="Heading">H</button>
                  <button onClick={() => insertFormatting('bold')} className="px-2 py-1 bg-white/5 hover:bg-white/10 rounded text-white text-sm font-bold" title="Bold">B</button>
                  <button onClick={() => insertFormatting('italic')} className="px-2 py-1 bg-white/5 hover:bg-white/10 rounded text-white text-sm italic" title="Italic">I</button>
                  <button onClick={() => insertFormatting('code')} className="px-2 py-1 bg-white/5 hover:bg-white/10 rounded text-white text-sm font-mono" title="Code">&lt;/&gt;</button>
                  <button onClick={() => insertFormatting('list')} className="px-2 py-1 bg-white/5 hover:bg-white/10 rounded text-white text-sm" title="List">•</button>
                  <button onClick={() => insertFormatting('checkbox')} className="px-2 py-1 bg-white/5 hover:bg-white/10 rounded text-white text-sm" title="Checkbox">☑</button>
                </div>
              )}

              {/* Content Area */}
              <div className="flex-1 overflow-y-auto p-6">
                {isEditing ? (
                  <textarea
                    ref={textareaRef}
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    className="w-full h-full bg-transparent border-none outline-none text-white resize-none font-mono"
                    placeholder="Start writing..."
                  />
                ) : (
                  <div 
                    className="prose prose-invert max-w-none text-white"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
                  />
                )}
              </div>

              {/* Footer */}
              <div className="p-3 border-t border-white/10 text-white/50 text-xs flex justify-between">
                <span>Last edited: {new Date(selectedDoc.lastEdited).toLocaleString()}</span>
                <span>Collaborators: {selectedDoc.editors.join(', ')}</span>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-white/50">
              <div className="text-center">
                <div className="text-6xl mb-4">📄</div>
                <p>Select a document or create a new one</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
