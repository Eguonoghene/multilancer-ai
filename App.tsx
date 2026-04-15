import React, { useState, useRef } from 'react';
import { Download, RefreshCw, Upload, Image as ImageIcon, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import axios from 'axios';

interface GeneratedImage {
  url: string;
  title: string;
  description: string;
  source: string;
}

export default function App() {
  const [description, setDescription] = useState('');
  const [designType, setDesignType] = useState('both');
  const [isGenerating, setIsGenerating] = useState(false);
  const [results, setResults] = useState<GeneratedImage[]>([]);
  const [activeTab, setActiveTab] = useState('all');
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      setError('Please provide a business description.');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setResults([]);

    try {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
      // 1. Primary: AI Concept Generation (5 Images)
      const primaryResults: GeneratedImage[] = [];
      
      try {
        const promises = Array.from({ length: 5 }).map(async (_, i) => {
          // Distribute background requirements: 2 white, 1 transparent, 2 standard
          let bgSuffix = '';
          let titleSuffix = '';
          if (i < 2) {
            bgSuffix = ' Isolated on a solid pure white background. High contrast.';
            titleSuffix = ' (White BG)';
          } else if (i === 2) {
            bgSuffix = ' Isolated on a transparent background, alpha channel, vector style.';
            titleSuffix = ' (Transparent)';
          }

          const prompt = `A professional, high-end ${designType} for a business described as: "${description}". 
          The design should be the primary focus. 
          Style: Modern, Minimalist, Corporate. 
          The main subject must be the ${designType} for the business.${bgSuffix}`;

          const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: [{ parts: [{ text: prompt }] }],
            config: {
              imageConfig: { aspectRatio: "1:1" }
            }
          });

          for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
              return {
                url: `data:image/png;base64,${part.inlineData.data}`,
                title: `Concept ${i + 1}${titleSuffix}`,
                description: `AI generated ${designType} concept.`,
                source: 'AI Engine'
              };
            }
          }
          return null;
        });

        const resolved = await Promise.allSettled(promises);
        resolved.forEach(res => {
          if (res.status === 'fulfilled' && res.value) {
            primaryResults.push(res.value);
          }
        });
      } catch (primaryErr) {
        console.error('Primary generation failed, falling back to backend', primaryErr);
      }

      // 2. Fallback/Supplement: Backend API (Stability, Pollinations, Pexels)
      const backendResponse = await axios.post('/api/generate', {
        business_description: description,
        design_type: designType,
        count: 10 - primaryResults.length
      });

      const backendData = backendResponse.data;
      setResults([...primaryResults, ...backendData].slice(0, 10));
    } catch (err) {
      setError('Failed to generate designs. Please try again.');
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadImage = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const simulateDownload = (type: string, image: GeneratedImage) => {
    // In a real app, this would call a server-side upscaling or PDF generation service
    const filename = `${image.title.replace(/\s+/g, '_').toLowerCase()}_${type}`;
    if (type === 'pdf') {
      alert(`Simulating PDF download for "${image.title}". In a production environment, this would generate a high-quality PDF document.`);
    } else {
      alert(`Simulating ${type} download for "${image.title}". The image is being processed for high resolution.`);
      downloadImage(image.url, `${filename}.png`);
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans">
      {/* Navigation */}
      <nav className="border-b border-slate-200 px-6 py-4 flex justify-between items-center max-w-7xl mx-auto">
        <div className="text-2xl font-bold text-slate-900">
          Multilanc<span className="text-green-600">er</span> Limited
        </div>
        <div className="hidden md:flex space-x-8 text-sm font-medium text-slate-600">
          <a href="#" className="hover:text-green-600 transition-colors">Home</a>
          <a href="#" className="hover:text-green-600 transition-colors">Generate</a>
          <a href="#" className="hover:text-green-600 transition-colors">History</a>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-12">
        {/* Hero */}
        <div className="text-center mb-16">
          <h1 className="text-5xl md:text-6xl font-extrabold text-slate-900 mb-4 tracking-tight">
            AI Logo & Flyer Generator
          </h1>
          <p className="text-xl text-slate-600 mb-2">Design your brand with intelligence.</p>
          <p className="text-slate-400">Create high-quality branding designs in seconds.</p>
        </div>

        {/* Generator Form */}
        <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-xl border border-slate-100 p-8 mb-16">
          <form onSubmit={handleGenerate} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Business Description <span className="text-red-500">*</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g., An innovative tech startup offering cloud-based data analytics solutions for small businesses..."
                className="w-full h-32 px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all resize-none text-slate-800 placeholder:text-slate-400"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Reference Image (Optional)
                </label>
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center justify-center w-full px-4 py-3 rounded-xl border border-dashed border-slate-300 hover:border-green-500 hover:bg-green-50 cursor-pointer transition-all group"
                >
                  <Upload className="w-5 h-5 text-slate-400 group-hover:text-green-600 mr-2" />
                  <span className="text-sm text-slate-500 group-hover:text-green-700 font-medium">
                    Upload Image
                  </span>
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Design Type
                </label>
                <select
                  value={designType}
                  onChange={(e) => setDesignType(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all bg-white text-slate-800"
                >
                  <option value="both">Both Logos & Flyers</option>
                  <option value="logo">Logo Only</option>
                  <option value="flyer">Flyer Only</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={isGenerating}
              className="w-full py-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl shadow-lg shadow-green-200 transition-all transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Generating Designs...</span>
                </>
              ) : (
                <span>Generate Designs</span>
              )}
            </button>
          </form>

          {error && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-center text-red-700 text-sm font-medium"
            >
              <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
              {error}
            </motion.div>
          )}
        </div>

        {/* Results Section */}
        <AnimatePresence>
          {(results.length > 0 || isGenerating) && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-8"
            >
              {/* Tabs */}
              <div className="flex justify-center p-1 bg-slate-100 rounded-xl w-fit mx-auto">
                {['all', 'logos', 'flyers'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-8 py-2 rounded-lg text-sm font-bold transition-all ${
                      activeTab === tab 
                        ? 'bg-white text-slate-900 shadow-sm' 
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>

              {/* Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-8">
                {isGenerating ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} className="bg-white rounded-2xl border border-slate-100 p-6 animate-pulse">
                      <div className="aspect-square bg-slate-100 rounded-xl mb-6" />
                      <div className="h-6 bg-slate-100 rounded w-3/4 mb-4" />
                      <div className="h-4 bg-slate-100 rounded w-full mb-2" />
                      <div className="h-4 bg-slate-100 rounded w-5/6 mb-6" />
                      <div className="grid grid-cols-2 gap-3">
                        <div className="h-10 bg-slate-100 rounded-lg" />
                        <div className="h-10 bg-slate-100 rounded-lg" />
                      </div>
                    </div>
                  ))
                ) : (
                  results.map((image, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.1 }}
                      className="group bg-white rounded-2xl border border-slate-100 p-6 hover:shadow-2xl hover:border-green-100 transition-all"
                    >
                      <div className="relative aspect-square rounded-xl overflow-hidden mb-6 bg-slate-50 border border-slate-100">
                        <img 
                          src={image.url} 
                          alt={image.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute top-3 right-3 bg-white/90 backdrop-blur px-3 py-1 rounded-full text-[10px] font-bold text-slate-600 shadow-sm border border-slate-100">
                          {image.source}
                        </div>
                      </div>
                      
                      <h3 className="text-xl font-bold text-slate-900 mb-2">{image.title}</h3>
                      <p className="text-slate-500 text-sm mb-6 line-clamp-2">{image.description}</p>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <button 
                          onClick={() => downloadImage(image.url, `${image.title.toLowerCase()}.png`)}
                          className="flex items-center justify-center px-4 py-2 bg-slate-50 hover:bg-green-50 text-slate-600 hover:text-green-700 border border-slate-200 hover:border-green-200 rounded-lg text-xs font-bold transition-all"
                        >
                          <Download className="w-3.5 h-3.5 mr-2" />
                          PNG
                        </button>
                        <button 
                          onClick={() => simulateDownload('4K', image)}
                          className="flex items-center justify-center px-4 py-2 bg-slate-50 hover:bg-green-50 text-slate-600 hover:text-green-700 border border-slate-200 hover:border-green-200 rounded-lg text-xs font-bold transition-all"
                        >
                          <ImageIcon className="w-3.5 h-3.5 mr-2" />
                          4K
                        </button>
                        <button 
                          onClick={() => simulateDownload('8K', image)}
                          className="flex items-center justify-center px-4 py-2 bg-slate-50 hover:bg-green-50 text-slate-600 hover:text-green-700 border border-slate-200 hover:border-green-200 rounded-lg text-xs font-bold transition-all"
                        >
                          <ImageIcon className="w-3.5 h-3.5 mr-2" />
                          8K
                        </button>
                        <button 
                          onClick={() => simulateDownload('pdf', image)}
                          className="flex items-center justify-center px-4 py-2 bg-slate-50 hover:bg-green-50 text-slate-600 hover:text-green-700 border border-slate-200 hover:border-green-200 rounded-lg text-xs font-bold transition-all"
                        >
                          <FileText className="w-3.5 h-3.5 mr-2" />
                          PDF
                        </button>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-100 mt-24 py-12 text-center text-slate-400 text-sm">
        <p>&copy; 2024 Multilancer Limited. All rights reserved.</p>
      </footer>
    </div>
  );
}
