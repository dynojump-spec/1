
import React, { useState } from 'react';
import { Plus, FileText, Trash2, ChevronLeft, RefreshCw, Archive } from 'lucide-react';
import { NovelDocument } from '../types';

interface Props {
  isOpen: boolean;
  documents: NovelDocument[];
  currentDocId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onMoveToTrash: (id: string) => void; 
  onRestore: (id: string) => void;      
  onPermanentDelete: (id: string) => void; 
  onEmptyTrash: () => void; 
  onToggle: () => void;
}

const Sidebar: React.FC<Props> = ({ 
  isOpen, 
  documents, 
  currentDocId, 
  onSelect, 
  onCreate, 
  onMoveToTrash,
  onRestore,
  onPermanentDelete,
  onEmptyTrash,
  onToggle 
}) => {
  const [view, setView] = useState<'library' | 'trash'>('library');

  const filteredDocs = documents.filter(doc => 
    view === 'library' ? !doc.isDeleted : doc.isDeleted
  );

  // Sort by last modified descending
  filteredDocs.sort((a, b) => b.lastModified - a.lastModified);

  return (
    <>
      {/* Mobile Backdrop: Closes sidebar when clicking outside */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={onToggle}
          aria-hidden="true"
        />
      )}

      <div 
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-zinc-900 border-r border-zinc-800 transform transition-transform duration-300 ease-in-out flex flex-col ${
          isOpen ? 'translate-x-0' : '-translate-x-64'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 pb-2 shrink-0">
          <h2 className="font-bold text-zinc-100 text-lg">NovelCraft</h2>
          <button onClick={onToggle} className="text-zinc-400 hover:text-zinc-100">
            <ChevronLeft size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex px-4 mb-2 shrink-0 gap-1">
          <button
            onClick={() => setView('library')}
            className={`flex-1 py-2 text-xs font-bold border-b-2 transition-colors flex items-center justify-center gap-1 ${
              view === 'library' 
                ? 'border-blue-500 text-blue-400 bg-zinc-800/50' 
                : 'border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30'
            } rounded-t-md`}
          >
            <Archive size={14} /> 보관함
          </button>
          <button
            onClick={() => setView('trash')}
            className={`flex-1 py-2 text-xs font-bold border-b-2 transition-colors flex items-center justify-center gap-1 ${
              view === 'trash' 
                ? 'border-red-500 text-red-400 bg-zinc-800/50' 
                : 'border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30'
            } rounded-t-md`}
          >
            <Trash2 size={14} /> 휴지통
          </button>
        </div>

        {/* Action Button (Create or Empty) */}
        <div className="px-4 pb-2 shrink-0">
          {view === 'library' ? (
            <button
              onClick={onCreate}
              className="flex items-center justify-center w-full gap-2 px-4 py-2 text-sm font-bold text-zinc-950 transition-colors bg-blue-500 rounded hover:bg-blue-400 shadow-sm"
            >
              <Plus size={16} />
              새 소설 작성
            </button>
          ) : (
            <button
              type="button"
              disabled={filteredDocs.length === 0}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (window.confirm("휴지통을 비우시겠습니까?\n모든 문서가 영구적으로 삭제됩니다.")) {
                  onEmptyTrash();
                }
              }}
              className={`flex items-center justify-center w-full gap-2 px-4 py-2 text-sm font-bold rounded transition-colors shadow-sm ${
                 filteredDocs.length === 0 
                 ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                 : 'text-red-100 bg-red-600 hover:bg-red-500'
              }`}
            >
              <Trash2 size={16} />
              휴지통 비우기
            </button>
          )}
        </div>

        {/* Document List */}
        <div className="flex-1 overflow-y-auto px-2 pb-4">
          <div className="space-y-1">
            {filteredDocs.map((doc) => (
              <div
                key={doc.id}
                className={`group flex items-center justify-between px-3 py-2 cursor-pointer rounded-md transition-all ${
                  currentDocId === doc.id
                    ? 'bg-zinc-800 shadow-sm ring-1 ring-zinc-700'
                    : 'hover:bg-zinc-800/50'
                }`}
                onClick={() => onSelect(doc.id)}
              >
                <div className="flex items-center gap-3 overflow-hidden flex-1">
                  <FileText size={16} className={`shrink-0 ${currentDocId === doc.id ? 'text-blue-400' : 'text-zinc-500'}`} />
                  <div className="overflow-hidden min-w-0">
                    <p className={`text-sm font-medium truncate ${
                        doc.isDeleted && currentDocId !== doc.id ? 'text-zinc-500 line-through' :
                        currentDocId === doc.id ? 'text-zinc-100' : 'text-zinc-400'
                      }`}
                    >
                      {doc.title || '무제'}
                    </p>
                    <p className="text-[10px] text-zinc-600 truncate">
                      {new Date(doc.lastModified).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                  {view === 'library' ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        onMoveToTrash(doc.id);
                      }}
                      className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-zinc-700 rounded" 
                      title="휴지통으로 이동"
                    >
                      <Trash2 size={14} />
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          onRestore(doc.id);
                        }}
                        className="p-1.5 text-zinc-500 hover:text-green-400 hover:bg-zinc-700 rounded"
                        title="복원하기"
                      >
                        <RefreshCw size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          if (window.confirm("영구 삭제하시겠습니까?")) {
                            onPermanentDelete(doc.id);
                          }
                        }}
                        className="p-1.5 text-red-400 hover:text-red-100 hover:bg-red-600 rounded"
                        title="영구 삭제 (삭제)"
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
          
          {filteredDocs.length === 0 && (
            <div className="mt-8 text-center text-zinc-600 text-sm flex flex-col items-center gap-2">
              {view === 'library' ? (
                <>
                  <Archive size={24} className="opacity-30" />
                  <p>보관함이 비어있습니다.</p>
                </>
              ) : (
                <>
                  <Trash2 size={24} className="opacity-30" />
                  <p>휴지통이 비어있습니다.</p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Sidebar;
