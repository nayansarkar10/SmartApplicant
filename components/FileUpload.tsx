import React, { useCallback, useState } from 'react';
import { Upload, FileText, X } from 'lucide-react';
import { ResumeFile } from '../types';

interface FileUploadProps {
  onFileSelect: (file: ResumeFile | null) => void;
  selectedFile: ResumeFile | null;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect, selectedFile }) => {
  const [isDragging, setIsDragging] = useState(false);

  const processFile = (file: File) => {
    if (file.type !== 'application/pdf') {
      alert('Currently only PDF resumes are supported for best analysis.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      // Extract base64 part
      const base64Data = result.split(',')[1];
      onFileSelect({
        name: file.name,
        type: file.type,
        data: base64Data
      });
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  if (selectedFile) {
    return (
      <div className="flex items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-white rounded-md border border-gray-100 shadow-sm">
            <FileText className="w-6 h-6 text-gray-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">{selectedFile.name}</p>
            <p className="text-xs text-gray-500">Ready for analysis</p>
          </div>
        </div>
        <button 
          onClick={() => onFileSelect(null)}
          className="p-1 hover:bg-gray-200 rounded-full transition-colors"
        >
          <X className="w-5 h-5 text-gray-400" />
        </button>
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={`
        relative border-2 border-dashed rounded-xl p-8 transition-all duration-200 text-center
        ${isDragging ? 'border-black bg-gray-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50/50'}
      `}
    >
      <input
        type="file"
        accept=".pdf"
        onChange={handleFileChange}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />
      <div className="flex flex-col items-center space-y-3 pointer-events-none">
        <div className="p-3 bg-gray-100 rounded-full">
          <Upload className="w-6 h-6 text-gray-600" />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900">Upload your Resume</p>
          <p className="text-xs text-gray-500 mt-1">PDF format supported</p>
        </div>
      </div>
    </div>
  );
};
