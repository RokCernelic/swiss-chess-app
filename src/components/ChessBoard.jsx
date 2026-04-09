const ChessBoard = () => (
  <svg
    width="112"
    height="112"
    viewBox="0 0 56 56"
    xmlns="http://www.w3.org/2000/svg"
    style={{ opacity: 0.75, flexShrink: 0 }}
  >
    <rect width="56" height="56" rx="3" fill="currentColor" opacity=".12"/>
    <clipPath id="cb"><rect width="56" height="56" rx="3"/></clipPath>
    <g clipPath="url(#cb)">
      {[0,1,2,3,4,5,6,7].flatMap(r =>
        [0,1,2,3,4,5,6,7].map(c =>
          (r+c)%2===0
            ? <rect key={`${r}-${c}`} x={c*7} y={r*7} width="7" height="7" fill="currentColor" opacity=".7"/>
            : null
        )
      )}
    </g>
    <rect width="56" height="56" rx="3" fill="none" stroke="currentColor" strokeWidth="1" opacity=".4"/>
  </svg>
)

export default ChessBoard
