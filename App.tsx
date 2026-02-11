import React, { useState } from 'react';
import { jsPDF } from 'jspdf';
import { 
  ArrowRight, 
  ChevronLeft, 
  Copy, 
  Download, 
  Mail, 
  RefreshCw, 
  Check, 
  FileText,
  ExternalLink,
  TrendingUp,
  AlertCircle,
  XCircle,
  CheckCircle2
} from 'lucide-react';

import { FileUpload } from './components/FileUpload';
import { Button } from './components/Button';
import { ChatSection } from './components/ChatSection';
import { LoadingOverlay } from './components/LoadingOverlay';
import { generateCoverLetter, generateEmailMessage, processChatInteraction } from './services/geminiService';
import { AppStep, ResumeFile, ChatMessage } from './types';

const App: React.FC = () => {
  // State
  const [step, setStep] = useState<AppStep>(AppStep.INPUT);
  const [resume, setResume] = useState<ResumeFile | null>(null);
  const [jobDescription, setJobDescription] = useState('');
  const [coverLetter, setCoverLetter] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [matchPercentage, setMatchPercentage] = useState(0);
  const [matchReason, setMatchReason] = useState('');
  const [strengths, setStrengths] = useState<string[]>([]);
  const [weaknesses, setWeaknesses] = useState<string[]>([]);
  const [coverLetterSources, setCoverLetterSources] = useState<{ title: string; uri: string }[]>([]);
  const [emailMessage, setEmailMessage] = useState('');
  
  // Chat State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);

  // Loading states
  const [isGeneratingCover, setIsGeneratingCover] = useState(false);
  const [isGeneratingEmail, setIsGeneratingEmail] = useState(false);
  
  // UI Feedback states
  const [copiedCover, setCopiedCover] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);

  // Handlers
  const handleGenerateCoverLetter = async () => {
    if (!resume || !jobDescription.trim()) return;
    
    setIsGeneratingCover(true);
    setChatMessages([]); // Reset chat on new generation
    try {
      const result = await generateCoverLetter(resume, jobDescription);
      setCoverLetter(result.text);
      setCompanyName(result.companyName);
      setMatchPercentage(result.matchPercentage);
      setMatchReason(result.matchReason);
      setStrengths(result.strengths || []);
      setWeaknesses(result.weaknesses || []);
      setCoverLetterSources(result.sources || []);
      setStep(AppStep.COVER_LETTER);
    } catch (error) {
      alert("Something went wrong generating the cover letter.");
    } finally {
      setIsGeneratingCover(false);
    }
  };

  const handleChatSubmit = async (message: string) => {
    // Only require resume for steps 2/3 or if user wants analysis in step 1. 
    // For Step 1, resume might be null if they are just typing JD. But let's pass null if so.
    
    const newHistory: ChatMessage[] = [...chatMessages, { role: 'user', text: message }];
    setChatMessages(newHistory);
    setIsChatLoading(true);

    let currentContent = '';
    if (step === AppStep.INPUT) currentContent = jobDescription;
    else if (step === AppStep.COVER_LETTER) currentContent = coverLetter;
    else if (step === AppStep.EMAIL_MESSAGE) currentContent = emailMessage;

    try {
      const result = await processChatInteraction(
        step,
        resume,
        jobDescription,
        currentContent,
        chatMessages, // Pass history before new message
        message
      );

      const botMessage: ChatMessage = {
        role: 'model',
        text: result.reply,
        isUpdate: !!result.updatedContent
      };

      setChatMessages(prev => [...prev, botMessage]);

      if (result.updatedContent) {
        if (step === AppStep.INPUT) setJobDescription(result.updatedContent);
        else if (step === AppStep.COVER_LETTER) setCoverLetter(result.updatedContent);
        else if (step === AppStep.EMAIL_MESSAGE) setEmailMessage(result.updatedContent);
      }

    } catch (error) {
      setChatMessages(prev => [...prev, { role: 'model', text: "Sorry, I couldn't process that request. Please try again." }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleGenerateEmail = async () => {
    if (!resume || !jobDescription) return;
    
    setIsGeneratingEmail(true);
    setChatMessages([]); // Reset chat for email step
    try {
      const result = await generateEmailMessage(resume, jobDescription, coverLetter);
      setEmailMessage(result);
      setStep(AppStep.EMAIL_MESSAGE);
    } catch (error) {
      alert("Something went wrong generating the email.");
    } finally {
      setIsGeneratingEmail(false);
    }
  };

  const handleDownloadPDF = () => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // A4 dimensions: 210 x 297 mm
    const marginLeft = 20;
    const marginTop = 20;
    const marginBottom = 20;
    const contentWidth = 170; // 210 - 20 - 20
    const pageHeight = 297;
    
    // Font settings: Helvetica 11pt
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(10, 10, 10); // Soft black for professional look

    // Split text into blocks by double newline
    const rawBlocks = coverLetter.split(/\n\s*\n/);
    
    let currentY = marginTop;
    const lineHeightFactor = 2.0; 
    const defaultLineHeightFactor = 1.15; // approximate default for jsPDF

    rawBlocks.forEach((block, index) => {
      if (!block.trim()) return;

      const lowerBlock = block.toLowerCase();

      // Logic to determine alignment
      const isSalutation = index === 0 && (lowerBlock.startsWith('dear') || lowerBlock.startsWith('to'));
      const isSignatureKeyword = lowerBlock.includes('sincerely') || lowerBlock.includes('regards') || lowerBlock.includes('best,') || lowerBlock.includes('warm regards');
      const isApplicationLine = lowerBlock.startsWith('application for') || lowerBlock.startsWith('subject:');
      
      const isLastBlock = index === rawBlocks.length - 1;
      
      // Treat as signature if it has keyword OR if it's the last block and relatively short (likely the contact info if split)
      const isSignature = isSignatureKeyword || (isLastBlock && block.length < 200);
      
      // Alignment Logic:
      // - Salutation (To, ...): Left
      // - Subject (Application for...): Left
      // - Signature (Warm regards...): Left
      // - Body: Justified
      
      let textToPrint = block;
      let alignMode: "left" | "justify" = "justify";

      if (isSalutation || isSignature || isApplicationLine) {
        alignMode = "left";
        // Preserve newlines for Header/Signature
        textToPrint = block.trim(); 
      } else {
        alignMode = "justify";
        // Flatten newlines for body paragraphs to allow smooth justification
        textToPrint = block.replace(/\n/g, ' ').trim();
      }

      // Calculate height
      const dims = doc.getTextDimensions(textToPrint, {
        maxWidth: contentWidth,
        fontSize: 11
      });
      
      // Adjust height calculation for custom line height
      const blockHeight = dims.h * (lineHeightFactor / defaultLineHeightFactor);

      // Page break check
      if (currentY + blockHeight > pageHeight - marginBottom) {
        doc.addPage();
        currentY = marginTop;
      }

      doc.text(textToPrint, marginLeft, currentY, {
        maxWidth: contentWidth,
        align: alignMode,
        lineHeightFactor: lineHeightFactor,
        baseline: 'top'
      });

      // Add spacing after block
      currentY += blockHeight + 8;
    });
    
    // Clean company name for filename
    const safeCompanyName = companyName.replace(/[^a-zA-Z0-9]/g, '_') || 'Cover_Letter';
    doc.save(`${safeCompanyName}.pdf`);
  };

  const copyToClipboard = async (text: string, isEmail: boolean) => {
    await navigator.clipboard.writeText(text);
    if (isEmail) {
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    } else {
      setCopiedCover(true);
      setTimeout(() => setCopiedCover(false), 2000);
    }
  };

  const handleResetForNewJob = () => {
    setJobDescription('');
    setCoverLetter('');
    setCompanyName('');
    setMatchPercentage(0);
    setMatchReason('');
    setStrengths([]);
    setWeaknesses([]);
    setCoverLetterSources([]);
    setEmailMessage('');
    setChatMessages([]);
    setStep(AppStep.INPUT);
  };

  const handleFullReset = () => {
    setResume(null);
    handleResetForNewJob();
  };

  // Helper to determine match color
  const getMatchColor = (percentage: number) => {
    if (percentage >= 80) return 'text-green-600 bg-green-50 border-green-100';
    if (percentage >= 50) return 'text-amber-600 bg-amber-50 border-amber-100';
    return 'text-red-600 bg-red-50 border-red-100';
  };

  // Render Methods
  const renderStep1 = () => (
    <div className="space-y-8 fade-in">
      {/* Chat Section for Step 1 - Top Position */}
      <div className="mb-6">
        <ChatSection 
          messages={chatMessages}
          onSendMessage={handleChatSubmit}
          isLoading={isChatLoading}
          placeholder="Ask AI to help analyze requirements or format text..."
        />
      </div>

      <div className="space-y-2">
        <h2 className="text-2xl font-semibold text-gray-900">Let's start with the basics</h2>
        <p className="text-gray-500">Upload your resume and paste the job details.</p>
      </div>

      <div className="space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">1. Your Resume</label>
          <FileUpload 
            selectedFile={resume} 
            onFileSelect={setResume} 
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">2. Job Description</label>
          <p className="text-xs text-gray-500 mb-2">We'll automatically detect the company name, analyze your fit, and research it.</p>
          <textarea
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            placeholder="Paste the job title and description here..."
            className="w-full h-40 p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-black focus:border-transparent outline-none resize-none bg-gray-50 transition-all"
          />
        </div>

        <Button 
          onClick={handleGenerateCoverLetter} 
          disabled={!resume || !jobDescription.trim() || isGeneratingCover}
          className="w-full"
        >
          Analyze and Generate <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  );

  const renderStep2 = () => {
    const matchColorClass = getMatchColor(matchPercentage);

    return (
      <div className="space-y-6 fade-in max-w-4xl mx-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-gray-900">Your Application</h2>
          <div className="flex space-x-2">
            {companyName && (
               <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                 {companyName}
               </span>
            )}
            <Button variant="secondary" onClick={handleResetForNewJob} className="!px-3 !py-2 text-sm">
              New Job
            </Button>
          </div>
        </div>

        {/* Match Score Card */}
        <div className={`p-5 rounded-xl border ${matchColorClass} flex items-start gap-4 transition-all`}>
           <div className="flex-shrink-0 mt-1">
              {matchPercentage >= 80 ? (
                <TrendingUp className="w-6 h-6" />
              ) : (
                <AlertCircle className="w-6 h-6" />
              )}
           </div>
           <div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold tracking-tight">{matchPercentage}%</span>
                <span className="text-sm font-medium opacity-80 uppercase tracking-wide">Match Score</span>
              </div>
              <p className="text-sm mt-1 opacity-90 leading-relaxed">
                {matchReason}
              </p>
           </div>
        </div>

        {/* Strengths & Weaknesses Grid */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-green-50/50 p-5 rounded-xl border border-green-100 transition-all hover:border-green-200">
            <h3 className="text-xs font-semibold text-green-800 uppercase tracking-wider mb-4 flex items-center">
              <CheckCircle2 className="w-4 h-4 mr-2" /> Match (Strengths)
            </h3>
            {strengths.length > 0 ? (
              <ul className="space-y-3">
                {strengths.map((strength, idx) => (
                  <li key={idx} className="text-sm text-green-900 flex items-start leading-relaxed">
                    <span className="mr-2 mt-1.5 w-1 h-1 rounded-full bg-green-400 flex-shrink-0"></span>
                    {strength}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-green-700 italic">No specific strengths detected.</p>
            )}
          </div>

          <div className="bg-gray-50/50 p-5 rounded-xl border border-gray-200 transition-all hover:border-gray-300">
            <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-4 flex items-center">
              <XCircle className="w-4 h-4 mr-2" /> Not Match (Gaps)
            </h3>
             {weaknesses.length > 0 ? (
              <ul className="space-y-3">
                {weaknesses.map((weakness, idx) => (
                  <li key={idx} className="text-sm text-gray-700 flex items-start leading-relaxed">
                    <span className="mr-2 mt-1.5 w-1 h-1 rounded-full bg-gray-400 flex-shrink-0"></span>
                    {weakness}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500 italic">No major gaps detected.</p>
            )}
          </div>
        </div>
        
        {/* Main Content Area */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Drafted Cover Letter</h3>
            <div className="flex gap-2">
               {/* Small actions can go here */}
            </div>
          </div>
          
          <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 min-h-[400px] whitespace-pre-wrap leading-relaxed text-gray-700 font-serif">
            {coverLetter}
          </div>
          
          {coverLetterSources.length > 0 && (
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
              <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Information sourced from</p>
              <div className="flex flex-wrap gap-2">
                {coverLetterSources.map((source, idx) => (
                  <a 
                    key={idx}
                    href={source.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-xs text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-1 rounded border border-blue-100 transition-colors"
                  >
                    {source.title}
                    <ExternalLink className="w-3 h-3 ml-1" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Actions Bar */}
        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-100">
          <Button onClick={handleDownloadPDF} variant="outline" className="flex-1">
            <Download className="w-4 h-4 mr-2" /> Download PDF
          </Button>
          <Button 
            onClick={() => copyToClipboard(coverLetter, false)} 
            variant="outline" 
            className="flex-1"
          >
            {copiedCover ? <Check className="w-4 h-4 mr-2 text-green-600" /> : <Copy className="w-4 h-4 mr-2" />}
            {copiedCover ? 'Copied' : 'Copy Text'}
          </Button>
          <Button onClick={handleGenerateEmail} className="flex-1 bg-black text-white hover:bg-gray-800" disabled={isGeneratingEmail}>
            Draft Email <Mail className="w-4 h-4 ml-2" />
          </Button>
        </div>

        {/* Chat Section for Step 2 */}
        <div className="pt-8 mt-8 border-t border-gray-100">
            <ChatSection 
              messages={chatMessages}
              onSendMessage={handleChatSubmit}
              isLoading={isChatLoading}
              placeholder="Ask AI to refine details, tone, or specific sections..."
            />
        </div>
      </div>
    );
  };

  const renderStep3 = () => (
    <div className="space-y-8 fade-in">
       <div className="flex items-center space-x-4 mb-6">
        <button 
          onClick={() => {
            setStep(AppStep.COVER_LETTER);
            setChatMessages([]); // Optional: clear chat when going back or keep it. Clearing to avoid confusion.
          }}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h2 className="text-2xl font-semibold text-gray-900">Hiring Manager Message</h2>
      </div>

      <div className="w-full max-w-4xl mx-auto space-y-4">
         <div className="bg-white p-8 rounded-xl shadow-md border border-gray-200 min-h-[400px] whitespace-pre-wrap leading-relaxed text-gray-800 text-lg relative">
             {emailMessage}
         </div>
         
         <div className="flex flex-col sm:flex-row gap-3 pt-4">
           <Button 
              onClick={() => copyToClipboard(emailMessage, true)} 
              variant="primary" 
              className="flex-1"
            >
              {copiedEmail ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
              {copiedEmail ? 'Copied to Clipboard' : 'Copy Message'}
            </Button>
            <Button onClick={handleResetForNewJob} variant="outline" className="flex-1">
              Start New Application
            </Button>
         </div>

         {/* Chat Section for Step 3 */}
         <div className="pt-8 mt-8 border-t border-gray-100">
            <ChatSection 
              messages={chatMessages}
              onSendMessage={handleChatSubmit}
              isLoading={isChatLoading}
              placeholder="Ask AI to shorten, lengthen, or change the tone..."
            />
         </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#fcfcfc] text-gray-900 font-sans selection:bg-gray-200">
      <LoadingOverlay 
        isVisible={isGeneratingCover || isGeneratingEmail} 
        message={isGeneratingCover ? "Analyzing fit & Writing..." : "Drafting Message..."} 
      />
      
      <div className="max-w-6xl mx-auto px-6 py-12">
        <header className="flex items-center justify-between mb-16 max-w-3xl mx-auto">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <h1 className="font-bold text-xl tracking-tight">SmartApplicant<span className="text-gray-400 font-normal">.ai</span></h1>
          </div>
          
          {resume && (
            <div className="flex items-center gap-4">
               <span className="text-xs font-medium text-gray-500 bg-gray-100 px-3 py-1 rounded-full hidden sm:block">
                  Resume Active: {resume.name.length > 15 ? resume.name.substring(0, 12) + '...' : resume.name}
               </span>
               <button 
                onClick={handleFullReset}
                className="text-gray-400 hover:text-black transition-colors p-2"
                title="Reset Resume"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          )}
        </header>

        <main className={step === AppStep.INPUT ? "max-w-3xl mx-auto" : "max-w-6xl mx-auto"}>
          {step === AppStep.INPUT && renderStep1()}
          {step === AppStep.COVER_LETTER && renderStep2()}
          {step === AppStep.EMAIL_MESSAGE && renderStep3()}
        </main>
        
        <footer className="mt-20 text-center text-sm text-gray-400 max-w-3xl mx-auto">
          <p>© {new Date().getFullYear()} AgentArtsy Job Tools. Powered by Gemini.</p>
        </footer>
      </div>
    </div>
  );
};

export default App;