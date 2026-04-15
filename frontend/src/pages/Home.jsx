import React from "react";
import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div className="flex flex-col gap-20 pb-20">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 lg:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center">
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-slate-900 mb-6">
              Master Your Material with{" "}
              <span className="heroAccentText">AI-Powered</span> Study Tools
            </h1>
            <p className="max-w-2xl mx-auto text-xl text-slate-600 mb-10 leading-relaxed">
              Transform dense text and PDFs into concise summaries and
              interactive quizzes in seconds. Built with classical NLP for
              transparency and speed.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/chatbot"
                className="heroPrimaryBtn px-8 py-4 bg-primary-600 text-white font-bold rounded-2xl shadow-xl shadow-primary-500/25 hover:bg-primary-700 hover:-translate-y-1 transition-all active:scale-95 text-lg"
              >
                Get Started for Free
              </Link>
              <Link
                to="/about"
                className="heroSecondaryBtn px-8 py-4 bg-white text-slate-700 font-bold rounded-2xl shadow-md border border-slate-200 hover:bg-slate-50 hover:-translate-y-1 transition-all active:scale-95 text-lg"
              >
                Learn How it Works
              </Link>
            </div>
          </div>
        </div>

        {/* Background Decorative Elements */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full z-0 pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary-200/30 blur-[120px] rounded-full" />
          <div className="absolute bottom-[10%] right-[-5%] w-[30%] h-[30%] bg-indigo-200/30 blur-[100px] rounded-full" />
        </div>
      </section>

      {/* Features Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              title: "Smart Summarization",
              desc: "Extract key points, keywords, and summaries from notes, articles, or PDFs using advanced TF-IDF ranking.",
              icon: (
                <svg
                  className="w-6 h-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h4m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              ),
              color: "bg-blue-500",
            },
            {
              title: "Question Generation",
              desc: "Turn important sentences into study questions automatically. Perfect for self-assessment and review.",
              icon: (
                <svg
                  className="w-6 h-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              ),
              color: "bg-purple-500",
            },
            {
              title: "Interactive Quizzes",
              desc: "Take MCQs and fill-in-the-blank tests with instant feedback. Export your results to PDF for offline study.",
              icon: (
                <svg
                  className="w-6 h-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                  />
                </svg>
              ),
              color: "bg-emerald-500",
            },
          ].map((feature, i) => (
            <div
              key={i}
              className="group p-8 bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all"
            >
              <div
                className={`w-12 h-12 ${feature.color} text-white rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-inherit/20`}
              >
                {feature.icon}
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">
                {feature.title}
              </h3>
              <p className="text-slate-600 leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Stats Section */}
      <section className="bg-slate-900 py-16 rounded-[3rem] mx-4 sm:mx-8 lg:mx-12 overflow-hidden relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { label: "Algorithm", value: "TF-IDF" },
              { label: "Quiz Limit", value: "20 Items" },
              { label: "Max Summary", value: "20 Lines" },
              { label: "Privacy", value: "100% Local" },
            ].map((stat, i) => (
              <div key={i}>
                <div className="text-3xl font-bold text-white mb-1">
                  {stat.value}
                </div>
                <div className="text-slate-400 text-sm font-medium uppercase tracking-wider">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/10 blur-3xl rounded-full -mr-32 -mt-32" />
      </section>

      {/* Why Section */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl font-bold text-slate-900 mb-6">
          Why Classical NLP?
        </h2>
        <div className="space-y-6 text-lg text-slate-600 leading-relaxed">
          <p>
            Large language models can paraphrase anything — but you don't always
            need a black box. This tool sticks to algorithms you can explain:
            TF-IDF for scoring sentences, a graph and PageRank for "which lines
            matter," and small rules for turning statements into questions.
          </p>
          <p>
            You keep full control of the stack and avoid subscription APIs for
            basic study tasks. Work through them in separate tabs with live
            progress tracking as you check answers.
          </p>
        </div>
      </section>

      {/* CTA Band */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-linear-to-br from-primary-600 to-indigo-700 rounded-[3rem] p-12 text-center text-white shadow-2xl shadow-primary-500/20 relative overflow-hidden">
          <div className="relative z-10">
            <h2 className="text-4xl font-extrabold mb-4">
              Ready to Transform Your Learning?
            </h2>
            <p className="text-primary-100 text-lg mb-8 max-w-xl mx-auto">
              Join thousands of students and researchers who use Text2Test to
              simplify their study workflow.
            </p>
            <Link
              to="/chatbot"
              className="ctaBandBtn inline-block px-10 py-4 bg-white text-primary-600 font-bold rounded-2xl hover:bg-primary-50 transition-colors shadow-lg active:scale-95"
            >
              Start Generating Now
            </Link>
          </div>
          {/* Decorative circles */}
          <div className="absolute top-0 left-0 w-40 h-40 bg-white/10 rounded-full -ml-20 -mt-20 blur-2xl" />
          <div className="absolute bottom-0 right-0 w-60 h-60 bg-indigo-500/20 rounded-full -mr-30 -mb-30 blur-3xl" />
        </div>
      </section>
    </div>
  );
}
