const receitas = {
  esfiha: {
    nome: "Esfiha",
    descricao: "Esfiha aberta",
    params: {
      pesoMassa: { valor: 32, label: "Peso da massa (g)", min: 20, max: 60 },
      pesoRecheio: { valor: 30, label: "Peso do recheio (g)", min: 20, max: 50 },
    },
    massa: {
      farinha: { nome: "Farinha", fator: 1, unidade: "g" },
      agua: { nome: "Água", fator: 0.325, unidade: "ml" },
      leite: { nome: "Leite", fator: 0.195, unidade: "ml" },
      oleo: { nome: "Óleo", fator: 0.13, unidade: "ml" },
      sal: { nome: "Sal", fator: 0.012, unidade: "g" },
      fermento: { nome: "Fermento", fator: 0.012, unidade: "g" },
    },
    fatorFarinha: 1.674,
    saborPrincipal: {
      id: "carne",
      nome: "Carne",
      ingredientes: {
        carne: { nome: "Carne moída", fator: 0.5, unidade: "g" },
        tomate: { nome: "Tomate", fator: 0.2, unidade: "g" },
        cebola: { nome: "Cebola", fator: 0.3, unidade: "g" },
        sucoLimao: { nome: "Suco de limão", fator: 0.012, unidade: "ml" },
        sal: { nome: "Sal", fator: 0.012, unidade: "g" },
        pimentaSiria: { nome: "Pimenta síria", fator: 0.0025, unidade: "g" },
        pimentaReino: { nome: "Pimenta do reino", fator: 0.0015, unidade: "g" },
      },
    },
  },
};
