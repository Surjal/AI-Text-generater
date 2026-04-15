import React from "react";

const algorithms = [
  {
    title: "TF-IDF Vectorization",
    work: "Each sentence is converted into a bag-of-words vector. We measure word importance by comparing frequency within a sentence to the entire document. High-scoring sentences form the extractive summary.",
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
  },
  {
    title: "Cosine Similarity Graph",
    work: "Sentences are compared pairwise using cosine similarity. A network is built where similar sentences are linked, allowing us to identify the most 'central' ideas in the text.",
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" /></svg>
  },
  {
    title: "PageRank Centrality",
    work: "Using the NetworkX library, we apply PageRank to our sentence graph. Sentences that 'agree' with many others rise to the top, ensuring representative summaries.",
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
  },
  {
    title: "Heuristic Quiz Engine",
    work: "MCQs are built by identifying key noun phrases and selecting 'distractors' from other parts of the text. Fill-in-the-blanks target high-entropy entities for testing comprehension.",
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
  },
  {
    title: "NLTK Tokenization",
    work: "Advanced sentence splitting using Punkt and POS tagging helps us understand the grammatical structure, which is vital for generating natural-sounding questions.",
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5a18.022 18.022 0 01-3.827-2.002m0 0A18.022 18.022 0 013.343 5.5m3.878 5a12.11 12.11 0 011.897-6.37M18 12a2 2 0 114 0 2 2 0 01-4 0zm0 0c0 1.103-.306 2.133-.834 3m0 0L13 21l-1.991-2.248M13 21l1.991-2.248" /></svg>
  },
];

const features = [
  "Extractive Summarization",
  "Question Generation",
  "MCQ Construction",
  "Fill-in-the-Blank Items",
  "PDF Text Extraction",
  "Instant Answer Checking",
  "Session History Tracking",
  "Professional PDF Export",
];

export default function About() {
  return (
    <div className="flex flex-col gap-16 py-8 animate-in fade-in duration-700">
      {/* Hero Section */}
      <section className="text-center space-y-4">
        <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight">The Science of Study</h1>
        <p className="text-xl text-slate-500 max-w-2xl mx-auto">
          Text2Test leverages classical Natural Language Processing to help you digest complex information faster.
        </p>
      </section>

      {/* Main Mission Card */}
      <section className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm p-8 md:p-12 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary-50 rounded-full -mr-32 -mt-32 transition-transform group-hover:scale-110 duration-700" />
        <div className="relative z-10 grid md:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary-50 text-primary-700 rounded-xl text-sm font-bold uppercase tracking-wider">
              Our Mission
            </div>
            <h2 className="text-3xl font-bold text-slate-900">Making sense of the noise.</h2>
            <div className="space-y-4 text-slate-600 leading-relaxed text-lg">
              <p>
                In an age of information overload, the ability to quickly extract the core meaning of a document is more valuable than ever.
              </p>
              <p>
                Text2Test isn't just a summarizer—it's a pedagogical tool designed to test your comprehension through automatically generated interactive assessments.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {features.map((f, i) => (
              <div key={i} className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100 group/item hover:bg-white hover:shadow-md transition-all">
                <div className="w-6 h-6 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center group-hover/item:bg-emerald-500 group-hover/item:text-white transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                </div>
                <span className="text-sm font-bold text-slate-700">{f}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Algorithms Section */}
      <section className="space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-slate-900">Under the Hood</h2>
          <p className="text-slate-500 mt-2">Transparent algorithms, no black-box mysteries.</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {algorithms.map((a, i) => (
            <div key={i} className="p-8 bg-white rounded-3xl border border-slate-200 hover:border-primary-400 hover:shadow-xl hover:-translate-y-1 transition-all group">
              <div className="w-12 h-12 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-primary-50 group-hover:text-primary-600 transition-all">
                {a.icon}
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">{a.title}</h3>
              <p className="text-slate-600 leading-relaxed text-sm">{a.work}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Note Section */}
      <section className="bg-slate-900 rounded-[2.5rem] p-12 text-white relative overflow-hidden">
        <div className="relative z-10 max-w-3xl">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-3">
            <svg className="w-6 h-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            A Note on Expectations
          </h2>
          <p className="text-slate-400 text-lg leading-relaxed">
            These algorithms prioritize speed and transparency. While they excel at processing structured academic text, the quality of results directly depends on the input. Longer, well-edited passages yield the best summaries and questions. Scanned documents require proper OCR before they can be processed by our engine.
          </p>
        </div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-primary-500/10 rounded-full -mr-48 -mb-48 blur-3xl" />
      </section>
    </div>
  );
}
