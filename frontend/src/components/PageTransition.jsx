import { motion } from 'framer-motion';

const pageVariants = {
    initial: {
        opacity: 0,
        y: 15,
        scale: 0.98
    },
    in: {
        opacity: 1,
        y: 0,
        scale: 1
    },
    out: {
        opacity: 0,
        y: -15,
        scale: 0.98
    }
};

const pageTransition = {
    type: 'tween',
    ease: 'anticipate',
    duration: 0.3
};

export default function PageTransition({ children }) {
    return (
        <motion.div
            initial="initial"
            animate="in"
            exit="out"
            variants={pageVariants}
            transition={pageTransition}
            style={{ minHeight: '100%', width: '100%', position: 'relative' }}
        >
            {children}
        </motion.div>
    );
}
