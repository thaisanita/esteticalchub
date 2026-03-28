export function exportAppointmentsToCSV(appointments) {
  if (!appointments || appointments.length === 0) {
    alert("Nenhum dado para exportar");
    return;
  }

  // 1. Cabeçalhos atualizados para o novo padrão
  const headers = ["Cliente", "Data", "Hora", "Procedimento", "Valor Bruto (€)", "Custo Produto (€)", "Lucro Líquido (€)"];
  
  const rows = appointments.map((a) => {
    // 2. Normalização de valores (Supabase vs Legado)
    const preco = parseFloat(String(a.valor || a.price || 0).replace(',', '.'));
    const custo = parseFloat(String(a.custo_produtos || a.productCost || 0).replace(',', '.'));
    const lucro = preco - custo;

    return [
      `"${a.cliente || a.clientName || ''}"`, // Aspas evitam que nomes com vírgula quebrem o CSV
      a.data || a.date,
      a.hora || a.time || '',
      `"${a.procedimento || a.procedure || ''}"`,
      preco.toFixed(2),
      custo.toFixed(2),
      lucro.toFixed(2)
    ];
  });

  // 3. Adiciona o BOM (Byte Order Mark) para o Excel reconhecer acentuação (UTF-8)
  const BOM = "\uFEFF";
  const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
  
  const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  
  // 4. Download dinâmico
  const link = document.createElement("a");
  const dataArquivo = new Date().toISOString().split('T')[0]; // Ex: 2026-01-06
  
  link.href = url;
  link.setAttribute("download", `atendimentos-backup-${dataArquivo}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url); // Limpa a memória
}