import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Upload, FileText, ArrowLeft, Loader } from 'lucide-react';
//import { useTheme } from '../contexts/ThemeContext';

export const PdfSummarizerPage: React.FC = () => {
  //const { theme } = useTheme();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [summary, setSummary] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const handleFileSelect = (file: File) => {
    if (file.type === 'application/pdf') {
      setSelectedFile(file);
      setSummary('');
    } else {
      alert('Please select a PDF file');
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  // Step 1: Upload PDF to backend
  const handleUpload = async () => {
    if (!selectedFile) {
      alert('Please select a PDF file');
      return;
    }

    setIsProcessing(true);
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('max_chars', '1000');
    formData.append('overlap', '200');

    try {
      const res = await fetch('http://localhost:8000/upload-pdf-only/', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error('Upload failed');
      await res.json();
      alert('PDF uploaded and processed successfully.');
    } catch (error) {
      console.error(error);
      alert('Error uploading PDF.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Step 2: Summarize using existing ChromaDB
  const handleSummarize = async () => {
    setIsProcessing(true);
    const formData = new FormData();
    formData.append('query', 'Summarize this PDF');
    formData.append('model', 'gemma3:1b');

    try {
      const res = await fetch('http://localhost:8000/summarize-existing/', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error('Summarization failed');
      const data = await res.json();
      setSummary(data.summary || 'No summary generated.');
    } catch (error) {
      console.error(error);
      alert('Error generating summary.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <Link
            to="/chatbots"
            className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors mb-6"
          >
            <ArrowLeft size={20} />
            Back to Chatbots
          </Link>

          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            PDF Summarizer
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Upload a PDF document to get an intelligent summary and key insights
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Upload Section */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Upload Document
            </h2>

            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                dragActive
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-300 dark:border-gray-600 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <Upload size={48} className="mx-auto text-gray-400 dark:text-gray-500 mb-4" />
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Drag and drop your PDF file here, or click to browse
              </p>

              <input
                type="file"
                accept=".pdf"
                onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-colors"
              >
                <FileText size={16} />
                Browse Files
              </label>
            </div>

            {selectedFile && (
              <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <FileText size={16} className="text-blue-600 dark:text-blue-400" />
                  <span className="font-medium text-blue-900 dark:text-blue-100">
                    {selectedFile.name}
                  </span>
                </div>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Size: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>

                {/* Two-step buttons */}
                <button
                  onClick={handleUpload}
                  disabled={isProcessing}
                  className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Upload PDF
                </button>

                <button
                  onClick={handleSummarize}
                  disabled={isProcessing}
                  className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isProcessing ? (
                    <>
                      <Loader size={16} className="animate-spin" />
                      Processing...
                    </>
                  ) : (
                    'Generate Summary'
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Summary Section */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Summary & Insights
            </h2>

            {summary ? (
              <div className="prose dark:prose-invert max-w-none">
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 text-sm leading-relaxed whitespace-pre-wrap">
                  {summary}
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <FileText size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                <p className="text-gray-500 dark:text-gray-400">
                  Upload a PDF and click "Generate Summary"
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
