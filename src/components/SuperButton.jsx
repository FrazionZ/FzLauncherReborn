import '../assets/css/superButton.css'

export default function SuperButton(props) {

    return (
      <button className={`btn-download-launch-game ${props.className}`} disabled={props.disabled} id={props.bid} onClick={() => { if(!props.disabled) if(props.onClick) props.onClick() }}>
        <div className="label">{props.text}</div>
        <svg
          width="368"
          height="91"
          viewBox="0 0 368 91"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M61.8049 5H60.0642L58.6998 6.08103L13.8949 41.581L8.94873 45.5L13.8949 49.419L58.6998 84.919L60.0642 86H61.8049H306.195H307.936L309.3 84.919L354.105 49.419L359.051 45.5L354.105 41.581L309.3 6.08103L307.936 5H306.195H61.8049Z"
            stroke="#D29334"
            strokeOpacity="0.3"
            strokeWidth="10"
          />
          <g filter="url(#filter0_d_1990_4200)">
            <path
              d="M306.195 10H61.8049L17 41V45.5L61.8049 81H306.195L351 45.5V41L306.195 10Z"
              fill="#D9D9D9"
              fillOpacity="0.01"
              shapeRendering="crispEdges"
            />
          </g>
          <mask
            id="mask0_1990_4200"
            style={{ maskType: 'alpha' }}
            maskUnits="userSpaceOnUse"
            x="17"
            y="10"
            width="334"
            height="71"
          >
            <path
              d="M306.195 10H61.8049L17 45.5L61.8049 81H306.195L351 45.5L306.195 10Z"
              fill="url(#paint0_linear_1990_4200)"
            />
          </mask>
          <g mask="url(#mask0_1990_4200)">
            <path
              d="M306.195 10H61.8049L17 45.5L61.8049 81H306.195L351 45.5L306.195 10Z"
              fill="url(#paint1_linear_1990_4200)"
            />
            <g id="hoverRect">
              <path d="M225 10H286L258 81H197L225 10Z" fill="white" fillOpacity="0.2" />
              <path d="M70 10H131L103 81H42L70 10Z" fill="white" fillOpacity="0.2" />
            </g>
          </g>
          <defs>
            <filter
              id="filter0_d_1990_4200"
              x="17"
              y="10"
              width="334"
              height="75"
              filterUnits="userSpaceOnUse"
              colorInterpolationFilters="sRGB"
            >
              <feFlood floodOpacity="0" result="BackgroundImageFix" />
              <feColorMatrix
                in="SourceAlpha"
                type="matrix"
                values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
                result="hardAlpha"
              />
              <feOffset dy="4" />
              <feComposite in2="hardAlpha" operator="out" />
              <feColorMatrix
                type="matrix"
                values="0 0 0 0 0.290196 0 0 0 0 0.133333 0 0 0 0 0.0156863 0 0 0 1 0"
              />
              <feBlend
                mode="normal"
                in2="BackgroundImageFix"
                result="effect1_dropShadow_1990_4200"
              />
              <feBlend
                mode="normal"
                in="SourceGraphic"
                in2="effect1_dropShadow_1990_4200"
                result="shape"
              />
            </filter>
            <linearGradient
              id="paint0_linear_1990_4200"
              x1="17"
              y1="10"
              x2="353.83"
              y2="63.0217"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#F79A08" />
              <stop offset="1" stopColor="#E15100" />
            </linearGradient>
            <linearGradient
              id="paint1_linear_1990_4200"
              x1="17"
              y1="10"
              x2="353.83"
              y2="63.0217"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#F79A08" />
              <stop offset="1" stopColor="#E15100" />
            </linearGradient>
          </defs>
        </svg>
      </button>
    )
}