"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Auto-retry for null.length errors
  const isNullLength = error?.message?.includes("null") && error?.message?.includes("length");

  if (isNullLength) {
    // Silently retry
    setTimeout(() => reset(), 200);
    return (
      <html><body>
        <div style={{display:"flex",height:"100vh",alignItems:"center",justifyContent:"center"}}>
          <p style={{color:"#888",fontSize:"14px"}}>正在恢复...</p>
        </div>
      </body></html>
    );
  }

  return (
    <html><body>
      <div style={{display:"flex",flexDirection:"column" as const,height:"100vh",alignItems:"center",justifyContent:"center",gap:"16px"}}>
        <h2 style={{fontSize:"18px",fontWeight:600}}>出了点问题</h2>
        <p style={{color:"#888",fontSize:"14px"}}>{error?.message || "页面加载错误"}</p>
        <button onClick={reset} style={{padding:"8px 24px",borderRadius:"8px",backgroundColor:"#7c3aed",color:"white",border:"none",cursor:"pointer"}}>
          重试
        </button>
      </div>
    </body></html>
  );
}
