const leagues=[
['Portugal','🇵🇹','Liga Portugal',['Sporting CP','FC Porto','SL Benfica','SC Braga','Vitória SC','Boavista','Rio Ave','FC Famalicão','Moreirense','Gil Vicente','Estoril Praia','Santa Clara']],
['Inglaterra','🏴','Premier League',['Arsenal','Liverpool','Manchester City','Manchester United','Chelsea','Tottenham Hotspur','Aston Villa','Newcastle United','Brighton','Everton','Nottingham Forest','West Ham United']],
['Espanha','🇪🇸','LaLiga',['Real Madrid','FC Barcelona','Atlético de Madrid','Athletic Club','Real Sociedad','Real Betis','Sevilla','Valencia','Villarreal','Girona']],
['Itália','🇮🇹','Serie A',['Inter','AC Milan','Juventus','Napoli','AS Roma','Lazio','Atalanta','Fiorentina','Bologna','Torino']],
['Alemanha','🇩🇪','Bundesliga',['Bayern München','Borussia Dortmund','Bayer Leverkusen','RB Leipzig','Eintracht Frankfurt','VfB Stuttgart','Werder Bremen','Hamburger SV']],
['França','🇫🇷','Ligue 1',['Paris Saint-Germain','Olympique de Marseille','Olympique Lyonnais','AS Monaco','Lille','OGC Nice','RC Lens','Stade Rennais']],
['Países Baixos','🇳🇱','Eredivisie',['Ajax','PSV','Feyenoord','AZ Alkmaar','FC Utrecht','FC Twente']],
['Brasil','🇧🇷','Série A',['Flamengo','Palmeiras','São Paulo','Santos','Corinthians','Fluminense','Botafogo','Grêmio','Internacional','Cruzeiro']],
['Argentina','🇦🇷','Primera División',['Boca Juniors','River Plate','Racing Club','Independiente','San Lorenzo','Estudiantes']],
['Japão','🇯🇵','J1 League',['Vissel Kobe','Yokohama F. Marinos','Urawa Red Diamonds','Kashima Antlers']],
['Coreia do Sul','🇰🇷','K League 1',['Ulsan HD','Jeonbuk Hyundai Motors','FC Seoul','Pohang Steelers']],
['Estados Unidos','🇺🇸','MLS',['Inter Miami','LA Galaxy','Los Angeles FC','Atlanta United','Seattle Sounders','New York City FC']],
['Escócia','🏴','Premiership',['Celtic','Rangers','Aberdeen','Heart of Midlothian']],
['Turquia','🇹🇷','Süper Lig',['Galatasaray','Fenerbahçe','Beşiktaş','Trabzonspor']],
['África do Sul','🇿🇦','Premiership',['Mamelodi Sundowns','Orlando Pirates','Kaizer Chiefs','SuperSport United']]];
export const clubs=leagues.flatMap(([country,flag,league,names])=>names.map((name,i)=>({id:country+'-'+i,name,country,flag,league,verified:false})));
