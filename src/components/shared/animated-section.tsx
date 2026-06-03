"use client";

import { motion, type HTMLMotionProps } from "framer-motion";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0 },
};

interface AnimatedSectionProps extends HTMLMotionProps<"div"> {
  delay?: number;
  children: React.ReactNode;
}

export function AnimatedSection({
  delay = 0,
  children,
  className,
  ...props
}: AnimatedSectionProps) {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={fadeUp}
      transition={{ duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function StaggerContainer({
  children,
  className,
  stagger = 0.06,
}: {
  children: React.ReactNode;
  className?: string;
  stagger?: number;
}) {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: stagger } },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      variants={fadeUp}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
