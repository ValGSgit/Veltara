// Fresnel-based atmospheric rim glow

uniform vec3 uSunDirection;
uniform vec3 uAtmosphereColor;
uniform float uAtmosphereStrength;

varying vec3 vNormal;
varying vec3 vPosition;

void main() {
  vec3 viewDir = normalize(cameraPosition - vPosition);
  vec3 normal = normalize(vNormal);
  vec3 sunDir = normalize(uSunDirection);

  // Fresnel rim effect
  float rim = 1.0 - max(dot(viewDir, normal), 0.0);
  rim = pow(rim, 3.5);

  // Sun-side brightening
  float sunFacing = max(dot(normal, sunDir) * 0.5 + 0.5, 0.0);

  float alpha = rim * uAtmosphereStrength * (0.4 + sunFacing * 0.6);

  // Twilight band — reddish tint at terminator
  float terminator = dot(normal, sunDir);
  vec3 twilight = mix(vec3(0.9, 0.3, 0.1), uAtmosphereColor, smoothstep(-0.2, 0.3, terminator));

  gl_FragColor = vec4(twilight, alpha);
}
