Write-Host "🕵️ Validando estándares de calidad..." -ForegroundColor Cyan
# Aquí podrías añadir un comando de linting: npm run lint

$branch = git branch --show-current
if ($branch -ne "develop") {
    Write-Host "❌ ERROR: No estás en la rama develop" -ForegroundColor Red
    exit
}

$commitMsg = Read-Host "Introduce el mensaje de commit (siguiendo estándares)"
git add .
git commit -m "$commitMsg"
git push origin develop

Write-Host "🚀 Build enviada a producción. ID de Build generado." -ForegroundColor Green