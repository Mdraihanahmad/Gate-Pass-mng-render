import React from 'react';
import { Link } from 'react-router-dom';

export default function About() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-indigo-600 via-sky-500 to-emerald-500 animate-gradient" />
      <div className="blob absolute bottom-10 right-6 w-72 h-72 bg-cyan-400/40 rounded-full" style={{ animationDelay: '2s' }} />
      <div className="blob absolute top-1/3 left-1/2 w-64 h-64 bg-amber-400/40 rounded-full" style={{ animationDelay: '4s' }} />

      <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">About</h1>
          <Link
            to="/student"
            className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm bg-white/70 dark:bg-gray-800/70 text-gray-800 dark:text-gray-200 border border-black/10 dark:border-white/10 shadow hover:bg-white/90 dark:hover:bg-gray-800/90 backdrop-blur"
          >
            Go to Home
          </Link>
        </div>

        {/* Developed By */}
        <div className="card student-glass border border-white/30 dark:border-white/10 p-4">
          <div className="text-base font-semibold mb-3">Developed By:</div>
          <div className="flex items-center gap-4">
            <div className="flex -space-x-4">
              <img src="/developer.jpg" alt="Md Raihan Ahmad" className="w-16 h-16 rounded-full object-cover border border-white/20 shadow ring-2 ring-gray-900" onError={(e)=>{e.currentTarget.style.display='none'}} />
              <img src="/faizan.jpg" alt="Md Faizan Ahmad" className="w-16 h-16 rounded-full object-cover border border-white/20 shadow ring-2 ring-gray-900" onError={(e)=>{e.currentTarget.style.display='none'}} />
            </div>
            <div className="text-sm">
              <div className="font-semibold">Md Raihan Ahmad <span aria-hidden>❤️</span></div>
              <div className="font-semibold">Md Faizan Ahmad <span aria-hidden>❤️</span></div>
            </div>
          </div>
        </div>

        {/* Credits */}
        <div className="card student-glass border border-white/30 dark:border-white/10 p-4">
          <div className="font-semibold mb-1">Credits:</div>
          <div className="italic text-gray-700 dark:text-gray-300">Dedicated to parents for their unconditional love and support.</div>
         
          <div className="font-semibold mb-1 mt-2 text-sm">Our Team
            <div className="italic text-gray-700 dark:text-gray-300">Md Raihan Ahmad <br/>Md Faizan Ahmad<br /> Suraj Kumar<br/>Md Tarique Hussain</div>
        
         <div className="mt-2 text-sm">connect at: <br /> <a href="https://www.linkedin.com/in/md-raihan-ahmad" target="_blank" rel="noreferrer" className="underline text-sky-600 dark:text-sky-400">www.linkedin.com/in/md-raihan-ahmad</a>
          <br />
          <a href="https://www.linkedin.com/in/md-faizan-ahmad-5a792a282?utm_source=share&utm_campaign=share_via&utm_content=profile&utm_medium=android_app" target="_blank" rel="noreferrer" className="underline text-sky-600 dark:text-sky-400">www.linkedin.com/in/md-faizan-ahmad</a>
          <br />
          <a href="https://www.linkedin.com/in/suraj-kumar-286ab5293?utm_source=share&utm_campaign=share_via&utm_content=profile&utm_medium=android_app" target="_blank" rel="noreferrer" className="underline text-sky-600 dark:text-sky-400">www.linkedin.com/in/suraj-kumar</a>
          <br />
          <a href="https://www.linkedin.com/in/trqoder?utm_source=share&utm_campaign=share_via&utm_content=profile&utm_medium=android_app" target="_blank" rel="noreferrer" className="underline text-sky-600 dark:text-sky-400">www.linkedin.com/in/trqoder</a>
          </div>

          <div className="mt-2 text-sm">connect at: <a href="https://www.instagram.com/md_raihan._7/" target="_blank" rel="noreferrer" className="underline text-sky-600 dark:text-sky-400">www.instagram.com/in/md-raihan-ahmad</a></div>
          </div>
        </div>

        {/* Feedback */}
        <div className="card student-glass border border-white/30 dark:border-white/10 p-4">
          <div className="font-semibold mb-1">Feedback:</div>
          <div className="text-sm">For any suggestion or feedback, mail us at<a href="mailto:support@mdraihanahmad47@gmail.com" className="underline text-sky-600 dark:text-sky-400"> mdraihanahmad47@gmail.com <br />mdfaizanahmad811@gmail.com</a></div>
        </div>

        {/* Privacy Policy */}
        <div className="card student-glass border border-white/30 dark:border-white/10 p-4">
          <div className="font-semibold mb-2">Privacy Policy:</div>
          <ul className="list-disc pl-5 text-sm space-y-1 text-gray-700 dark:text-gray-300">
            <li>We collect account details (name, registration number, branch, batch), optional profile photo, and authentication credentials to operate the gate pass system.</li>
            <li>Gate activity logs (check-in/out time, purpose) are stored to provide functionality and audit trails.</li>
            <li>Some data is cached on your device for offline use; you can clear the app storage to remove it.</li>
            <li>We do not sell your data. Data is used only to run this service and improve reliability and security.</li>
            <li>Transport uses HTTPS; sensitive data such as PINs are never stored in plain text on the server.</li>
          </ul>
        </div>

        {/* Terms and Condition */}
        <div className="card student-glass border border-white/30 dark:border-white/10 p-4">
          <div className="font-semibold mb-2">Terms and Condition:</div>
          <ul className="list-disc pl-5 text-sm space-y-1 text-gray-700 dark:text-gray-300">
            <li>This app is intended for authorized students and staff for campus entry/exit management.</li>
            <li>You are responsible for keeping your credentials and 6‑digit PIN confidential.</li>
            <li>Misuse of QR codes or attempting to bypass verification may result in disciplinary action.</li>
            <li>Service availability is best‑effort; planned or unplanned outages may occur.</li>
            <li>The app is provided “as is” without warranties; use constitutes acceptance of these terms.</li>
            <li>We may update these terms and the app from time to time; continued use indicates acceptance.</li>
          </ul>
        </div>

      </div>

      {/* Floating Home button */}
      <Link
        to="/student"
        className="fixed bottom-5 right-5 z-50 inline-flex items-center justify-center rounded-full h-12 w-12 bg-white/80 dark:bg-gray-800/80 text-gray-900 dark:text-gray-100 border border-black/10 dark:border-white/10 shadow-xl backdrop-blur hover:bg-white/95 dark:hover:bg-gray-800/95"
        aria-label="Go to Home"
        title="Go to Home"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M12 3.172 2.586 12.586l1.414 1.414L5 13v7h5v-4h4v4h5v-7l1 1 1.414-1.414L12 3.172z"/></svg>
      </Link>
    </div>
  );
}
