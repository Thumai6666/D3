// chart6.js
// Doanh số trung bình theo khung giờ — CHỈ TÍNH TRÊN NHỮNG NGÀY CÓ BÁN (avgObserved)
// Steps:
// 1) Sum per (yyyy-mm-dd, intervalStart) => dailyIntervalTotals
// 2) For each intervalStart, avgObserved = mean(daily totals for that interval)

function parseNumber(v) {
  if (v == null) return 0;
  const s = String(v).replace(/[^\d\.\-]/g, '');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function parseDateSafe(s) {
  if (!s) return null;
  let d = new Date(s);
  if (!isNaN(d)) return d;
  const p1 = d3.timeParse("%Y-%m-%d %H:%M:%S")(s);
  if (p1) return p1;
  const p2 = d3.timeParse("%Y-%m-%dT%H:%M:%S")(s);
  if (p2) return p2;
  const p3 = d3.timeParse("%d/%m/%Y %H:%M:%S")(s);
  if (p3) return p3;
  const p4 = d3.timeParse("%Y-%m-%d")(s);
  if (p4) return p4;
  try {
    const s2 = s.replace('T',' ').split('.')[0];
    d = new Date(s2);
    return isNaN(d) ? null : d;
  } catch(e) {
    return null;
  }
}

function pad2(n){ return String(n).padStart(2,'0'); }
function fmtIntervalLabel(startMin, intervalMinutes){
  const h1 = Math.floor(startMin/60), m1 = startMin % 60;
  const endMin = Math.min(startMin + intervalMinutes - 1, 24*60 - 1);
  const h2 = Math.floor(endMin/60), m2 = endMin % 60;
  return `${pad2(h1)}:${pad2(m1)} - ${pad2(h2)}:${pad2(m2)}`;
}

function escapeHtml(s){ return String(s||'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'); }

/* CONFIG */
const csvFile = "data_ggsheet.csv"; // đổi tên nếu cần
const intervalMinutes = 60;         // 60 (mặc định). đổi thành 30 / 15 nếu muốn khung nhỏ hơn
const startHour = 8;                // bắt đầu
const endHour = 23;                 // kết thúc
/* END CONFIG */

d3.csv("data_ggsheet.csv").then(raw => {
  // parse rows
  raw.forEach(r => {
    r._dateObj = parseDateSafe(r["Thời gian tạo đơn"]);
    r._revenue = parseNumber(r["Thành tiền"]);
    r._qty = parseNumber(r["SL"]);
  });

  const withDate = raw.filter(r => r._dateObj);

  // build interval starts (minutes)
  const firstMin = startHour * 60;
  const lastMin = endHour * 60;
  const intervalStarts = [];
  for (let t = firstMin; t <= lastMin; t += intervalMinutes) intervalStarts.push(t);

  // 1) Sum per (dateKey, intervalStart)
  const perDateInterval = d3.rollup(
    withDate,
    rows => ({
      revenue: d3.sum(rows, r => r._revenue),
      qty: d3.sum(rows, r => r._qty),
      txCount: rows.length
    }),
    r => {
      const d = r._dateObj;
      const yyyy = d.getFullYear(), mm = pad2(d.getMonth()+1), dd = pad2(d.getDate());
      const dateKey = `${yyyy}-${mm}-${dd}`;
      const minutes = d.getHours()*60 + d.getMinutes();
      if (minutes < firstMin || minutes > (lastMin + intervalMinutes - 1)) return "__OUT__";
      const intervalStart = Math.floor(minutes / intervalMinutes) * intervalMinutes;
      return `${dateKey}___${intervalStart}`;
    }
  );

  // daily-interval totals array
  const dailyIntervalTotals = Array.from(perDateInterval, ([key, val]) => {
    if (key === "__OUT__") return null;
    const [dateKey, startStr] = key.split("___");
    return {
      dateKey,
      intervalStart: +startStr,
      revenue: val.revenue,
      qty: val.qty,
      txCount: val.txCount
    };
  }).filter(d=>d);

  // 2) Group by intervalStart and compute avgObserved (mean of daily totals for that interval)
  const perInterval = d3.rollup(
    dailyIntervalTotals,
    rows => ({
      avgRevenueObserved: d3.mean(rows, r => r.revenue),
      avgQtyObserved: d3.mean(rows, r => r.qty),
      daysObserved: rows.length
    }),
    d => d.intervalStart
  );

  // build final data (only avgObserved used)
  const data = intervalStarts.map(startMin => {
    const v = perInterval.get(startMin);
    return {
      intervalStart: startMin,
      label: fmtIntervalLabel(startMin, intervalMinutes),
      avgRevenueObserved: v ? v.avgRevenueObserved : 0,
      avgQtyObserved: v ? v.avgQtyObserved : 0,
      daysObserved: v ? v.daysObserved : 0
    };
  });

  // ---------- draw (UI consistent with previous charts) ----------
  const margin = { top: 50, right: 30, bottom: 100, left: 100 };
  const innerWidth = 1300;
  const innerHeight = 420;
  const svgW = margin.left + innerWidth + margin.right;
  const svgH = margin.top + innerHeight + margin.bottom;

  d3.select("#chart6").selectAll("*").remove();
  const svg = d3.select("#chart6").append("svg")
    .attr("width", svgW)
    .attr("height", svgH);

  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3.scaleBand()
    .domain(data.map(d => d.label))
    .range([0, innerWidth])
    .paddingInner(0.3)
    .paddingOuter(0.3);

  const yMax = d3.max(data, d => d.avgRevenueObserved) || 1;
  const y = d3.scaleLinear()
    .domain([0, yMax * 1.15]).nice()
    .range([innerHeight, 0]);

  const color = d3.scaleOrdinal().domain(data.map(d => d.intervalStart)).range(d3.schemeSet2);

  // grid
  g.append("g")
    .attr("class", "grid")
    .call(d3.axisLeft(y).ticks(6).tickSize(-innerWidth).tickFormat(""))
    .call(g => g.select(".domain").remove())
    .call(g => g.selectAll("line").attr("stroke","#eee").attr("stroke-dasharray","3,3"));

  // X axis (rotate to fit)
  g.append("g")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x))
    .call(g => g.select(".domain").remove())
    .selectAll("text")
    .style("font-size","11px")
    .style("fill","#333")
    .attr("text-anchor","end")
    .attr("transform","rotate(-35)");

  // Y axis (M)
  g.append("g")
    .call(d3.axisLeft(y).ticks(6).tickFormat(d => (d / 1e3).toFixed(0) + "K"))
    .call(g => g.select(".domain").remove())
    .selectAll("text")
    .style("font-size","12px")
    .style("fill","#333");

  // tooltip (use your style.css .tooltip)
  const tooltip = d3.select("body").append("div").attr("class","tooltip");

  // bars = avgObservedRevenue (only days that had sales)
  g.selectAll(".bar")
    .data(data)
    .enter().append("rect")
    .attr("class","bar")
    .attr("x", d => x(d.label))
    .attr("y", d => y(d.avgRevenueObserved))
    .attr("width", x.bandwidth())
    .attr("height", d => innerHeight - y(d.avgRevenueObserved))
    .attr("rx",6)
    .attr("fill", d => color(d.intervalStart))
    .on("mouseover", function(event,d) {
      d3.select(this).attr("fill", d3.color(color(d.intervalStart)).darker(0.6).toString());
      tooltip.style("visibility","visible").html(
        `<b>${escapeHtml(d.label)}</b><br/>
         Doanh số bán TB: ${d3.format(",.0f")(d.avgRevenueObserved)} VND<br/>
         Số lượng bán TB: ${d.avgQtyObserved ? d3.format(",.1f")(d.avgQtyObserved) : 0} SKUs`
      );
    })
    .on("mousemove", function(event) {
      tooltip.style("left",(event.pageX+12)+"px").style("top",(event.pageY-28)+"px");
    })
    .on("mouseout", function(event,d) {
      d3.select(this).attr("fill", color(d.intervalStart));
      tooltip.style("visibility","hidden");
    });

  // labels on top (show in M)
  g.selectAll(".barValue")
    .data(data)
    .enter().append("text")
    .attr("class","barValue")
    .attr("x", d => x(d.label) + x.bandwidth()/2)
    .attr("y", d => y(d.avgRevenueObserved) - 8)
    .attr("text-anchor","middle")
    .style("font-size","11px")
    .style("fill","#222")
    .text(d => d.avgRevenueObserved > 0 
    ? `${d3.format(",.0f")(d.avgRevenueObserved)} VND` 
    : "");

  // title
  svg.append("text")
    .attr("x", svgW/2).attr("y", 28)
    .attr("text-anchor","middle")
    .style("font-size","18px").style("font-weight","700")
    .text(`Doanh số bán hàng trung bình theo khung giờ`);
});
