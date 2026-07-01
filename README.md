# Calculadora de Receitas

Calculadora online para planejar receitas com base na quantidade desejada ou na farinha disponível. Comece com esfiha, adicione suas próprias receitas no futuro.

**[Acesse aqui](https://annamadi.github.io/calculadora-receitas/)**

## Funcionalidades

- **Dois modos de cálculo**: informe a quantidade de esfihas desejada ou a farinha disponível
- **Múltiplos sabores**: separe por sabor (carne + extras)
- **Lista de mercado**: checklist com persistência local
- **Editor de receitas**: ajuste proporções, salve versões com histórico
- **Compartilhamento**: copie link com estado completo ou salve imagem
- **PWA**: funciona offline após primeiro acesso
- **Aviso de sobra**: no modo farinha, sugere quantidade exata para não desperdiçar

## Tecnologias

- HTML/CSS/JS puro (sem framework, sem build step)
- Service Worker para cache offline
- LocalStorage para checklist e versões de receita
- URL params para compartilhamento de estado
- GitHub Pages para hospedagem

## Desenvolvimento local

```bash
# Qualquer servidor estático serve
python3 -m http.server 8000
# Acesse http://localhost:8000
```

## Estrutura

```
├── index.html       # Estrutura da página
├── style.css        # Estilos (paleta food-themed)
├── app.js           # Lógica principal (cálculo, render, URL)
├── receitas.js      # Dados das receitas (extensível)
├── editor.js        # Editor de receitas + versionamento
├── sw.js            # Service Worker (cache offline)
├── manifest.json    # PWA manifest
└── icon.svg         # Ícone do app
```

## Licença

MIT
