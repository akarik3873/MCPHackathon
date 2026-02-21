import { useState, useRef } from 'react';

export default function FileUpload({ onFileSelect, currentFile }) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onFileSelect(file);
  };

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleChange = (e) => {
    const file = e.target.files[0];
    if (file) onFileSelect(file);
  };

  return (
    <div
      className={`file-upload ${isDragging ? 'dragging' : ''} ${currentFile ? 'has-file' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
    >
      <input
        ref={inputRef}
        type="file"
        onChange={handleChange}
        accept="image/*,.pdf,.txt,.csv,.md,.json"
        hidden
      />
      {currentFile ? (
        <div className="file-info">
          <span className="file-icon">&#128196;</span>
          <span className="file-name">{currentFile.name}</span>
          <span className="file-size">({(currentFile.size / 1024).toFixed(1)} KB)</span>
        </div>
      ) : (
        <div className="upload-prompt">
          <span className="upload-icon">&#128228;</span>
          <p>Drag & drop a file here, or click to browse</p>
          <p className="upload-hint">Images, PDFs, text files up to 20MB</p>
        </div>
      )}
    </div>
  );
}
