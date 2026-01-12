import { useState, useMemo } from 'react';
import { Target, TrendingUp, ArrowRight, AlertCircle } from 'lucide-react';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';

interface ForecastingWidgetProps {
    cr: number; // Connection Rate (0-1)
    prr: number; // Positive Reply Rate (0-1)
    abr: number; // Appt Booking Rate (0-1)
    bookedRate: number; // Booked / Perm Sent (0-1)
}

export default function ForecastingWidget({ cr, prr, abr, bookedRate }: ForecastingWidgetProps) {
    const [targetBooked, setTargetBooked] = useState<number>(5);
    const [timeframe, setTimeframe] = useState<'week' | 'month'>('week');

    // Safe rates (avoid divide by zero)
    const effectiveBookedRate = bookedRate > 0 ? bookedRate : 0.01; // Default to 1% if 0 to show *some* estimation
    const effectiveCr = cr > 0 ? cr : 0.2; // Default to 20% if 0

    // Calculations
    // Goal: X Booked Calls
    // Required Perm Sent = X / BookedRate
    // Required Conn Sent = Required Perm Sent / CR (Assuming 1:1 Acc -> Perm Sent)

    const requiredPermSent = Math.ceil(targetBooked / effectiveBookedRate);
    const requiredConnSent = Math.ceil(requiredPermSent / effectiveCr);

    // Derived
    const predictedReplies = Math.ceil(requiredPermSent * prr);
    const predictedOffers = Math.ceil(requiredPermSent * abr);

    const isEstimating = bookedRate === 0 || cr === 0;

    return (
        <div className="card-base bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border-indigo-500/20">
            <div className="flex items-center gap-2 mb-6">
                <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400">
                    <TrendingUp size={20} />
                </div>
                <div>
                    <h3 className="font-semibold text-white">Reverse Forecasting</h3>
                    <p className="text-xs text-muted-foreground">Calculate required activity to hit your goals based on your actual performance.</p>
                </div>
            </div>

            <div className="flex flex-col gap-6">
                {/* Input Section */}
                <div className="flex items-center gap-4 bg-secondary/30 p-4 rounded-xl border border-white/5">
                    <div className="flex-1">
                        <label className="text-xs font-bold text-muted-foreground uppercase opacity-70 mb-1 block">I want to book:</label>
                        <div className="flex items-center gap-3">
                            <input
                                type="number"
                                min="1"
                                value={targetBooked}
                                onChange={e => setTargetBooked(Math.max(1, parseInt(e.target.value) || 0))}
                                className="text-3xl font-bold bg-transparent border-none outline-none w-24 text-indigo-400 font-mono"
                            />
                            <span className="text-lg font-medium text-muted-foreground">calls</span>
                        </div>
                    </div>

                    <div className="h-10 w-px bg-white/10"></div>

                    <div className="flex gap-2">
                        <button
                            onClick={() => setTimeframe('week')}
                            className={clsx("px-3 py-1.5 rounded-lg text-xs font-bold transition-colors", timeframe === 'week' ? "bg-indigo-500 text-white" : "bg-secondary text-muted-foreground hover:bg-secondary/80")}
                        >
                            This Week
                        </button>
                        <button
                            onClick={() => setTimeframe('month')}
                            className={clsx("px-3 py-1.5 rounded-lg text-xs font-bold transition-colors", timeframe === 'month' ? "bg-indigo-500 text-white" : "bg-secondary text-muted-foreground hover:bg-secondary/80")}
                        >
                            This Month
                        </button>
                    </div>
                </div>

                {isEstimating && (
                    <div className="flex items-center gap-2 text-xs text-amber-500 bg-amber-500/10 p-2 rounded border border-amber-500/20">
                        <AlertCircle size={14} />
                        Using default industry baselines (CR 20%, Booked 1%) because your historical data involves 0 rates.
                    </div>
                )}

                {/* Path Visualization */}
                <div className="relative pt-2 pb-4">
                    <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-500/50 via-purple-500/50 to-emerald-500/50"></div>

                    <Step
                        label="Connection Requests"
                        value={requiredConnSent}
                        sub={`~${Math.ceil(requiredConnSent / (timeframe === 'week' ? 5 : 20))} / day`}
                        color="text-blue-400"
                    />

                    <ArrowDown />

                    <Step
                        label="Permission Messages"
                        value={requiredPermSent}
                        sub={`~${Math.ceil(requiredPermSent / (timeframe === 'week' ? 5 : 20))} / day`}
                        color="text-purple-400"
                    />

                    <ArrowDown />

                    <div className="ml-8 grid grid-cols-2 gap-4 mb-4 opacity-50">
                        <div className="text-xs">
                            <span className="block font-bold text-white mb-0.5">{predictedReplies}</span>
                            <span className="text-muted-foreground">Pos. Replies</span>
                        </div>
                        <div className="text-xs">
                            <span className="block font-bold text-white mb-0.5">{predictedOffers}</span>
                            <span className="text-muted-foreground">Offers Sent</span>
                        </div>
                    </div>

                    <ArrowDown />

                    <motion.div
                        key={targetBooked}
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="ml-8 bg-emerald-500/20 p-3 rounded-xl border border-emerald-500/30 flex items-center justify-between"
                    >
                        <span className="font-bold text-emerald-400">Booked Calls</span>
                        <span className="font-mono font-bold text-xl text-white">{targetBooked}</span>
                    </motion.div>
                </div>
            </div>
        </div>
    );
}

function Step({ label, value, sub, color }: any) {
    return (
        <div className="ml-8 mb-1">
            <div className="flex justify-between items-baseline mb-1">
                <span className={clsx("font-bold text-sm", color)}>{label}</span>
                <span className="font-mono font-bold text-lg text-white">{value}</span>
            </div>
            {sub && <div className="text-xs text-muted-foreground text-right">{sub}</div>}
        </div>
    );
}

function ArrowDown() {
    return (
        <div className="ml-4 -ml-[7px] my-2 text-muted-foreground/30">
            {/* Simple dot or arrow indicator on the line */}
            <div className="w-1.5 h-1.5 rounded-full bg-white/20"></div>
        </div>
    );
}
