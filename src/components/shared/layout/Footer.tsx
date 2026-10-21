"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { LOGO_ALT_CONFIG } from "@/modules/navigation/config/navigation-items";
import { config } from "@/config";

export default function Footer() {
  return (
    <footer className="glass-surface py-16 mt-10">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Resources Column */}
          <div>
            <h3 className="font-semibold text-[#1a1a1a] mb-4">Resources</h3>
            <ul className="space-y-2">
              <li>
                <Link
                  href="https://mapp.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#1a1a1a]/65 hover:text-primary transition-colors duration-300"
                >
                  Mapp Website
                </Link>
              </li>
              <li>
                <Link
                  href="https://mapp.com/blog"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#1a1a1a]/65 hover:text-primary transition-colors duration-300"
                >
                  Mapp Blog
                </Link>
              </li>
              <li>
                <Link
                  href="https://mapp.com/resources"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#1a1a1a]/65 hover:text-primary transition-colors duration-300"
                >
                  Mapp Resources
                </Link>
              </li>
              <li>
                <Link
                  href="https://mapp.com/learning"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#1a1a1a]/65 hover:text-primary transition-colors duration-300"
                >
                  Mapp Learning
                </Link>
              </li>
            </ul>
          </div>

          {/* Logo Column */}
          <div className="flex justify-center md:justify-end">
            <div className="text-center md:text-right">
              <Image
                src={LOGO_ALT_CONFIG.src}
                alt={LOGO_ALT_CONFIG.alt}
                width={120}
                height={48}
                className="h-12 w-auto mx-auto md:mx-0"
              />
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-8 pt-8 border-t border-white/70">
          <div className="flex gap-2 justify-between text-xs text-[#1a1a1a]/60">
            <div>
              Copyright &copy; {new Date().getFullYear()} Mapp Digital UK Ltd.
              All Rights Reserved.
            </div>
            <div className="flex items-center gap-2">
              {config.app.environment === "staging" && (
                <span className="text-[#1a1a1a]/45">
                  v{config.app.version} ({config.app.commit})
                </span>
              )}
              <Link
                href="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#1a1a1a]/60 hover:text-primary transition-colors duration-300"
              >
                Privacy
              </Link>
              <span> | </span>
              <Link
                href="https://mapp.com/legal"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#1a1a1a]/60 hover:text-primary transition-colors duration-300"
              >
                Legal
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
