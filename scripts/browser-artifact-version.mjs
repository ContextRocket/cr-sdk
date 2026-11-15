export function browserArtifactVersion(packageJson, packageJsonPath) {
  const version = packageJson.browserArtifactVersion ?? packageJson.version;
  if (typeof version !== "string" || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error(`Invalid browser artifact version in ${packageJsonPath}`);
  }
  return version;
}
